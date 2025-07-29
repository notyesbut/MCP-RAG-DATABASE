#!/bin/bash

# Continuous TypeScript Validation Monitor
# Agent: TypeValidationTester
# Purpose: Monitor type fixes in real-time and provide immediate feedback

echo "🚀 Starting Continuous TypeScript Validation Monitor"
echo "Target: 114 → 0 errors"
echo "Press Ctrl+C to stop monitoring"
echo "=================================================="

LAST_ERROR_COUNT=114
VALIDATION_INTERVAL=10  # seconds

while true; do
    # Run validation check
    CURRENT_ERROR_COUNT=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
    
    # Check for changes
    if [ "$CURRENT_ERROR_COUNT" -ne "$LAST_ERROR_COUNT" ]; then
        echo ""
        echo "🔄 CHANGE DETECTED - $(date)"
        echo "   Previous: $LAST_ERROR_COUNT errors"
        echo "   Current:  $CURRENT_ERROR_COUNT errors"
        
        if [ "$CURRENT_ERROR_COUNT" -lt "$LAST_ERROR_COUNT" ]; then
            IMPROVEMENT=$((LAST_ERROR_COUNT - CURRENT_ERROR_COUNT))
            echo "   ✅ IMPROVEMENT: -$IMPROVEMENT errors"
            npx claude-flow@alpha hooks notify --message "PROGRESS: $IMPROVEMENT errors fixed! Now at $CURRENT_ERROR_COUNT errors" --level "success" 2>/dev/null || true
        elif [ "$CURRENT_ERROR_COUNT" -gt "$LAST_ERROR_COUNT" ]; then
            REGRESSION=$((CURRENT_ERROR_COUNT - LAST_ERROR_COUNT))
            echo "   ❌ REGRESSION: +$REGRESSION errors"
            npx claude-flow@alpha hooks notify --message "REGRESSION: $REGRESSION new errors introduced! Now at $CURRENT_ERROR_COUNT errors" --level "error" 2>/dev/null || true
        fi
        
        # Show current top errors
        echo "   🚨 Top Current Errors:"
        npx tsc --noEmit 2>&1 | grep "error TS" | head -2 | sed 's/^/      /'
        
        LAST_ERROR_COUNT=$CURRENT_ERROR_COUNT
        
        # Check if we've reached the goal
        if [ "$CURRENT_ERROR_COUNT" -eq 0 ]; then
            echo ""
            echo "🎉 SUCCESS! Zero TypeScript errors achieved!"
            npx claude-flow@alpha hooks notify --message "VALIDATION COMPLETE: Zero TypeScript errors achieved!" --level "success" 2>/dev/null || true
            break
        fi
    else
        printf "."  # Progress indicator
    fi
    
    sleep $VALIDATION_INTERVAL
done