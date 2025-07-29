#!/bin/bash

# TypeScript Validation Monitor Script
# Agent: TypeValidationTester

echo "🔍 TypeScript Validation Check - $(date)"
echo "=================================================="

# Count current errors
ERROR_COUNT=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
echo "📊 Current TypeScript Errors: $ERROR_COUNT"

# Save to validation log
echo "$(date): $ERROR_COUNT errors" >> validation-progress.log

# Check if target reached
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ SUCCESS: Zero TypeScript errors achieved!"
    npx claude-flow@alpha hooks notify --message "VALIDATION SUCCESS: Zero TypeScript errors achieved" --level "success" 2>/dev/null || true
    exit 0
else
    echo "🎯 Target: $ERROR_COUNT → 0 errors"
    
    # Show error categories
    echo ""
    echo "📋 Error Breakdown:"
    npx tsc --noEmit 2>&1 | grep "error TS" | cut -d':' -f4 | sort | uniq -c | sort -nr | head -5
    
    # Show most critical errors
    echo ""
    echo "🚨 Most Critical Errors:"
    npx tsc --noEmit 2>&1 | grep "error TS" | head -3
    
    # Notify about current status
    npx claude-flow@alpha hooks notify --message "VALIDATION: $ERROR_COUNT TypeScript errors remaining" --level "warning" 2>/dev/null || true
fi

echo ""
echo "📈 Progress Tracking:"
if [ -f validation-progress.log ]; then
    tail -5 validation-progress.log
fi

echo "=================================================="