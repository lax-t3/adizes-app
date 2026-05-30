#!/bin/bash
# PostToolUse hook: run tsc --noEmit after editing .ts/.tsx files in adizes-frontend
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

# Only trigger for TypeScript files inside adizes-frontend
if echo "$FILE" | grep -q "adizes-frontend" && echo "$FILE" | grep -qE '\.(ts|tsx)$'; then
    cd /Users/vrln/adizes-frontend || exit 0
    OUTPUT=$(npm run lint 2>&1 | grep -v "^>" | grep -v "^$" | head -40)
    EXIT_CODE=${PIPESTATUS[0]}
    if [ -n "$OUTPUT" ] && echo "$OUTPUT" | grep -qiE "error TS|error:"; then
        echo "TypeScript errors detected after editing $FILE:"
        echo "$OUTPUT"
    fi
fi

exit 0
