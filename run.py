import sys
import os
from multiprocessing import freeze_support

# Ensure the current directory is in sys.path so 'app' can be imported
sys.path.insert(0, os.path.abspath("."))

from app.main import main

if __name__ == "__main__":
    freeze_support()
    main()
