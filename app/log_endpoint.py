"""
独立的日志端点应用，运行在端口8901。
提供调试日志访问功能，即使主应用崩溃也能工作。
通过请求头 'X-Log-Access-Key' 进行认证。
"""

import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse
import uvicorn
import subprocess
from .config import PROJECT_ROOT

# 配置
LOG_PORT = 8901
LOG_ACCESS_KEY = "web-dl-manager-debug-key-2024"  # 默认访问密钥
LOG_FILES = [
    "logs/camouflage.log",
    "logs/main.log",
    "logs/log_endpoint.log",
    "logs/app.log",
    "startup.log"
]

app = FastAPI(title="Web-DL-Manager Log Endpoint")

def get_log_content(log_file: str) -> str:
    """读取日志文件内容"""
    try:
        log_path = PROJECT_ROOT / log_file
        if log_path.exists():
            return log_path.read_text(encoding='utf-8', errors='ignore')
        else:
            return f"Log file not found: {log_file}"
    except Exception as e:
        return f"Error reading log file {log_file}: {str(e)}"

def get_all_logs() -> str:
    """获取所有日志文件的内容"""
    result = []
    for log_file in LOG_FILES:
        content = get_log_content(log_file)
        result.append(f"=== {log_file} ===")
        result.append(content)
        result.append("\n")
    return "\n".join(result)

@app.get("/")
async def root():
    """根端点，显示基本信息"""
    return {
        "service": "Web-DL-Manager Log Endpoint",
        "port": LOG_PORT,
        "available_logs": LOG_FILES,
        "endpoints": {
            "/": "This info",
            "/logs": "Get all logs (requires X-Log-Access-Key header)",
            "/logs/{filename}": "Get specific log file (requires X-Log-Access-Key header)",
            "/health": "Health check"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "service": "log_endpoint"}

@app.get("/logs")
async def get_logs(request: Request, access_key: str = None):
    """获取所有日志内容，需要认证"""
    # 优先从URL参数获取密钥，如果没有则从请求头获取
    if access_key is None:
        access_key = request.headers.get("X-Log-Access-Key")
    
    if access_key != LOG_ACCESS_KEY:
        raise HTTPException(status_code=403, detail="Invalid access key")
    
    return PlainTextResponse(content=get_all_logs())

@app.get("/logs/{filename}")
async def get_log_file(filename: str, request: Request, access_key: str = None):
    """获取特定日志文件内容，需要认证"""
    # 优先从URL参数获取密钥，如果没有则从请求头获取
    if access_key is None:
        access_key = request.headers.get("X-Log-Access-Key")
    
    if access_key != LOG_ACCESS_KEY:
        raise HTTPException(status_code=403, detail="Invalid access key")
    
    # 安全验证：只允许访问预定义的日志文件
    if filename not in LOG_FILES:
        raise HTTPException(status_code=404, detail="Log file not found")
    
    return PlainTextResponse(content=get_log_content(filename))

def start_tunnel_if_needed():
    """启动内网穿透连接到日志端点（8901端口）"""
    tunnel_token = os.getenv("TUNNEL_TOKEN")
    if tunnel_token:
        try:
            # 启动cloudflared隧道，连接到日志端点端口
            subprocess.Popen(
                ['cloudflared', 'tunnel', '--no-autoupdate', 'run', '--token', tunnel_token],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            print(f"Cloudflare tunnel started for log endpoint (port {LOG_PORT})")
        except Exception as e:
            print(f"Failed to start Cloudflare tunnel: {e}")

def run_log_endpoint():
    """运行日志端点应用"""
    print(f"Starting log endpoint on http://0.0.0.0:{LOG_PORT}")
    print(f"Access key: {LOG_ACCESS_KEY}")
    print("Use header: X-Log-Access-Key: web-dl-manager-debug-key-2024")
    
    # 确保logs目录存在
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # 启动内网穿透（如果配置了）
    start_tunnel_if_needed()
    
    # 运行FastAPI应用
    uvicorn.run(app, host="0.0.0.0", port=LOG_PORT, log_level="info")

if __name__ == "__main__":
    run_log_endpoint()
