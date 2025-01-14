#!/usr/bin/env python3

"""
This script updates the latestAnnouncementId in ClineProvider.ts to match
the current version. This ensures users see the announcement once after
each version update.

Environment Variables:
    VERSION: The version number to use as the announcement ID
"""

import os
import re

VERSION = os.environ['VERSION']
PROVIDER_PATH = "src/core/webview/ClineProvider.ts"

def update_announcement_id():
    with open(PROVIDER_PATH, 'r') as f:
        content = f.read()
    
    # Find the line with latestAnnouncementId
    pattern = r'private latestAnnouncementId = "[^"]+"'
    replacement = f'private latestAnnouncementId = "{VERSION}"'
    
    # Replace with new version
    updated_content = re.sub(pattern, replacement, content)
    
    with open(PROVIDER_PATH, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated latestAnnouncementId to {VERSION}")

if __name__ == "__main__":
    update_announcement_id()