import os
import subprocess
import logging

logger = logging.getLogger(__name__)

class TunnelManager:
    def __init__(self):
        self.tunnel_process = None
        self.is_running = False
        self.tunnel_type = None
        self.tunnel_token = None

    def start_cloudflare_tunnel(self, token: str) -> bool:
        """启动Cloudflare隧道"""
        try:
            # 启动cloudflared隧道，不输出日志
            self.tunnel_process = subprocess.Popen(
                ['cloudflared', 'tunnel', '--no-autoupdate', 'run', '--token', token],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            self.is_running = True
            self.tunnel_type = 'cloudflare'
            self.tunnel_token = token
            
            return True
        except Exception:
            self.is_running = False
            return False

    def stop_tunnel(self) -> bool:
        """停止隧道"""
        try:
            if not self.is_running or not self.tunnel_process:
                return False

            # 终止进程
            self.tunnel_process.terminate()
            try:
                self.tunnel_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.tunnel_process.kill()
                self.tunnel_process.wait()

            self.is_running = False
            self.tunnel_process = None
            self.tunnel_type = None
            self.tunnel_token = None
            
            return True
        except Exception:
            return False

    def get_tunnel_status(self) -> dict:
        """获取隧道状态"""
        if self.is_running and self.tunnel_process:
            # 检查进程是否仍然存活
            if self.tunnel_process.poll() is not None:
                self.is_running = False
                self.tunnel_process = None

        return {
            "is_running": self.is_running,
            "tunnel_type": self.tunnel_type,
            "tunnel_token_set": bool(self.tunnel_token)
        }

# 全局隧道管理器实例
tunnel_manager = TunnelManager()