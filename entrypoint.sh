#!/bin/bash

# 设置默认值
DEFAULT_GIT_URL="https://github.com/Jyf0214/upgraded-doodle.git"
DEFAULT_GIT_BRANCH="gh-pages"

# 检查环境变量，如果未设置则使用默认值
TARGET_GIT_URL=${STATIC_SITE_GIT_URL:-$DEFAULT_GIT_URL}
TARGET_GIT_BRANCH=${STATIC_SITE_GIT_BRANCH:-$DEFAULT_GIT_BRANCH}

# 定义静态文件存放目录
STATIC_SITE_DIR="/app/static_site"

# 如果设置了静态站点的 URL，则进行克隆
if [ -n "$TARGET_GIT_URL" ]; then
    echo "Cloning static site from $TARGET_GIT_URL (branch: $TARGET_GIT_BRANCH)..."
    
    # 创建目录
    mkdir -p $STATIC_SITE_DIR
    
    # 克隆指定分支到目标目录
    git clone --depth 1 --branch "$TARGET_GIT_BRANCH" "$TARGET_GIT_URL" "$STATIC_SITE_DIR"
    
    if [ $? -eq 0 ]; then
        echo "Cloning successful."
    else
        echo "Cloning failed. Please check the URL and branch name."
        # 即使克隆失败，也创建一个空目录，以防应用启动失败
        mkdir -p $STATIC_SITE_DIR
    fi
else
    echo "STATIC_SITE_GIT_URL not set. Skipping clone."
    # 确保目录存在
    mkdir -p $STATIC_SITE_DIR
fi

echo "--- INSTALLED PACKAGES ---"
pip list
echo "--- PYTHONPATH ---"
echo $PYTHONPATH
echo "--- sys.path ---"
python -c "import sys; print(sys.path)"

# 启动 FastAPI 应用
echo "Starting Uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
