import os
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Depends, Form
from fastapi.responses import RedirectResponse
from ptyprocess import PtyProcessUnicode

from ..auth import get_current_user
from ..database import User, db_config
from ..templating import templates
from ..i18n import get_lang

router = APIRouter(tags=["terminal"])

@router.get("/terminal")
async def get_terminal(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    terminal_enabled = db_config.get_config("TERMINAL_ENABLED", "false").lower() == "true"
    
    return templates.TemplateResponse("terminal.html", {
        "request": request,
        "user": current_user.username,
        "lang": lang,
        "terminal_enabled": terminal_enabled
    })

@router.post("/terminal/enable")
async def enable_terminal(request: Request, confirm: bool = Form(...), current_user: User = Depends(get_current_user)):
    if confirm:
        db_config.set_config("TERMINAL_ENABLED", "true")
        db_config.clear_cache()
    return RedirectResponse(url="/terminal", status_code=303)

@router.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    # Check if terminal is enabled in DB
    terminal_enabled = db_config.get_config("TERMINAL_ENABLED", "false").lower() == "true"
    if not terminal_enabled:
        await websocket.accept()
        await websocket.send_text("\r\nTerminal is disabled in settings.\r\n")
        await websocket.close(code=4003)
        return

    await websocket.accept()
    
    # WebSocket 不直接支持 Depends(get_current_user) 如果它依赖于 session
    # 但 SessionMiddleware 会填充 scope['session']
    session = websocket.scope.get("session")
    if not session or "user" not in session:
        logging.warning("Terminal WebSocket connection rejected: Not authenticated")
        await websocket.close(code=4003)
        return

    username = session.get("user")
    logging.info(f"User {username} connected to terminal")

    # 默认 shell
    shell = os.environ.get("SHELL", "/bin/bash")
    if not os.path.exists(shell):
        shell = "/bin/sh"
    
    # 启动伪终端进程
    # 设置 TERM 环境变量以便支持颜色和复杂 UI
    try:
        # 确保所有环境变量都是字符串
        env = {str(k): str(v) for k, v in os.environ.items()}
        env["TERM"] = "xterm-256color"
        process = PtyProcessUnicode.spawn([shell], env=env)
    except Exception as e:
        logging.error(f"Failed to spawn shell: {e}")
        await websocket.send_text(f"\r\nFailed to spawn shell: {e}\r\n")
        await websocket.close()
        return
    
    async def read_from_pty():
        loop = asyncio.get_event_loop()
        try:
            while process.isalive():
                # 使用 loop.run_in_executor 将阻塞读放入线程池
                data = await loop.run_in_executor(None, process.read, 1024)
                if data:
                    await websocket.send_text(data)
                else:
                    break
        except EOFError:
            pass
        except Exception as e:
            logging.error(f"Terminal read error: {e}")
        finally:
            await websocket.close()

    async def write_to_pty():
        try:
            while True:
                data = await websocket.receive_text()
                # 处理调整窗口大小的特殊指令 (可选，xterm.js 发送的数据通常是输入)
                # 如果要支持 resize，需要定义协议，这里简单处理
                process.write(data)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logging.error(f"Terminal write error: {e}")
        finally:
            if process.isalive():
                process.terminate(force=True)

    # 运行并发任务
    read_task = asyncio.create_task(read_from_pty())
    write_task = asyncio.create_task(write_to_pty())
    
    try:
        await asyncio.wait([read_task, write_task], return_when=asyncio.FIRST_COMPLETED)
    finally:
        read_task.cancel()
        write_task.cancel()
        if process.isalive():
            process.terminate(force=True)
        logging.info(f"User {username} terminal session ended")
