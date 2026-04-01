import subprocess
import os

cwd = r"c:\Projects\Mess_Marketplace"
try:
    result = subprocess.run(["git", "status"], cwd=cwd, capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    result2 = subprocess.run(["git", "diff", "--name-only"], cwd=cwd, capture_output=True, text=True)
    print("MODIFIED FILES:", result2.stdout)
except Exception as e:
    print("ERROR:", str(e))
