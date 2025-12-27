# Claude Local Settings

This directory contains local settings for Claude Code (Anthropic's AI coding assistant).

## Setup Instructions

### 1. Create your local settings file

Copy the example template to create your own local settings:

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

Or on Windows:
```cmd
copy .claude\settings.local.json.example .claude\settings.local.json
```

### 2. Update placeholder values

Edit `.claude/settings.local.json` and replace the placeholder values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<LOCAL_PROJECT_PATH>` | Your local project directory path | `d:\\exe.blue\\ai-fram` |
| `<SERVER_IP>` | Your server's IP address | `192.168.1.100` |

### 3. Example configuration

After replacement, your file should look like:

```json
{
  "permissions": {
    "allow": [
      "Bash(ssh:*)",
      "Bash(scp -o StrictHostKeyChecking=no \"d:\\\\your\\\\project\\\\path\\\\deploy\\\\vultr_setup.sh\" root@192.168.1.100:/root/)",
      "Bash(ping:*)",
      "Bash(tasklist:*)",
      "Bash(findstr:*)",
      "Bash(cat:*)",
      "Bash(where:*)",
      "Bash(dir:*)",
      "Bash(tar:*)",
      "Bash(scp:*)"
    ]
  }
}
```

## Important Notes

- **DO NOT** commit `settings.local.json` - it contains sensitive information (IP addresses, paths)
- The file is already in `.gitignore` to prevent accidental commits
- Only commit changes to `settings.local.json.example` (the template)