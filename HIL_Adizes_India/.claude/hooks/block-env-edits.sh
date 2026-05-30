#!/bin/bash
# PreToolUse hook: block edits to .env files (not .env.example)
# Receives tool call JSON on stdin

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    fp = d.get('tool_input', {}).get('file_path', '')
    print(fp)
except:
    print('')
" 2>/dev/null || echo "")

if echo "$FILE" | grep -qE '\.env$' && ! echo "$FILE" | grep -qE '\.env\.(example|sample|template)$'; then
    echo "BLOCKED: Direct .env edits are not allowed."
    echo "Reason: .env leaking into Docker images caused production incidents (see CLAUDE.md Key Decisions)."
    echo "To rotate keys after supabase start, use the /rotate-env skill."
    exit 2
fi

exit 0
