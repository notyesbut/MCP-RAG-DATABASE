#!/bin/bash

# ⚡ Load testing Enterprise Multi-MCP Smart Database System

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test parameters (can be changed)
CONCURRENT_USERS=${1:-50}
REQUESTS_PER_USER=${2:-20}
RAMP_UP_TIME=${3:-10}
TEST_DURATION=${4:-60}

print_header() {
    echo -e "${BLUE}"
    echo "⚡ =================================================="
    echo "   LOAD TESTING MCP DATABASE"
    echo "=================================================="
    echo "🔧 Test Parameters:"
    echo "   👥 Concurrent Users: $CONCURRENT_USERS"
    echo "   📊 Requests per User: $REQUESTS_PER_USER"
    echo "   ⏱️ Ramp-up Time: ${RAMP_UP_TIME}s"
    echo "   🕐 Test Duration: ${TEST_DURATION}s"
    echo "==================================================${NC}"
    echo ""
}

check_system() {
    echo -e "${BLUE}🔍 Checking system readiness...${NC}"
    
    if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
        echo -e "${RED}❌ System is not running! Start it with: npm start${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ System is ready for testing${NC}"
    echo ""
}

# Function to generate random test data
generate_test_data() {
    local user_id=$1
    local request_id=$2
    local data_type=$((RANDOM % 4))
    
    case $data_type in
        0)
            # User activity
            echo '{
                "data": {
                    "user_activity": {
                        "userId": "load_test_user_'$user_id'",
                        "action": "page_view",
                        "page": "/dashboard",
                        "timestamp": '$(date +%s000)',
                        "sessionId": "session_'$user_id'_'$request_id'",
                        "userAgent": "LoadTestAgent/1.0"
                    }
                },
                "metadata": {
                    "source": "load_test",
                    "testId": "'$user_id'_'$request_id'"
                }
            }'
            ;;
        1)
            # Chat messages
            echo '{
                "data": {
                    "chat_message": {
                        "messageId": "load_msg_'$user_id'_'$request_id'",
                        "content": "Test message from user '$user_id' request '$request_id'",
                        "userId": "load_test_user_'$user_id'",
                        "channelId": "load_test_channel",
                        "timestamp": '$(date +%s000)'
                    }
                }
            }'
            ;;
        2)
            # System metrics
            echo '{
                "data": {
                    "system_metric": {
                        "metricId": "load_metric_'$user_id'_'$request_id'",
                        "name": "cpu_usage",
                        "value": '$(($RANDOM % 100))',
                        "timestamp": '$(date +%s000)',
                        "source": "load_test_server_'$user_id'"
                    }
                }
            }'
            ;;
        3)
            # Log entry
            echo '{
                "data": {
                    "log_entry": {
                        "logId": "load_log_'$user_id'_'$request_id'",
                        "level": "INFO",
                        "message": "Load test log entry from user '$user_id' request '$request_id'",
                        "timestamp": '$(date +%s000)',
                        "source": "load_test"
                    }
                }
            }'
            ;;
    esac
}

# Function to execute requests for a single user
simulate_user() {
    local user_id=$1
    local start_delay=$2
    
    # Wait for ramp-up time
    sleep $start_delay
    
    local successful_requests=0
    local failed_requests=0
    local total_response_time=0
    
    for request_id in $(seq 1 $REQUESTS_PER_USER); do
        local start_time=$(date +%s%3N)
        
        # Generate test data
        local test_data=$(generate_test_data $user_id $request_id)
        
        # Send request
        local response=$(curl -s -w "%{\http_code}" -X POST http://localhost:3000/api/v1/ingest \
            -H "Content-Type: application/json" \
            -d "$test_data" 2>/dev/null)
        
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        total_response_time=$((total_response_time + response_time))
        
        # Check request success
        local http_code="${response: -3}"
        local response_body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            local success=$(echo "$response_body" | jq -r '.success' 2>/dev/null)
            if [ "$success" = "true" ]; then
                successful_requests=$((successful_requests + 1))
            else
                failed_requests=$((failed_requests + 1))
            fi
        else
            failed_requests=$((failed_requests + 1))
        fi
        
        # Random pause between requests (50-200ms)
        sleep 0.$(($RANDOM % 150 + 50))
    done
    
    local avg_response_time=$((total_response_time / REQUESTS_PER_USER))
    
    # Write results to a temporary file
    echo "$user_id,$successful_requests,$failed_requests,$avg_response_time" >> /tmp/load_test_results.csv
}

# Function to monitor the system during the test
monitor_system() {
    local test_start_time=$(date +%s)
    
    echo "timestamp,memory_mb,connections,qps,avg_response_ms,cache_hit_rate" > /tmp/system_metrics.csv
    
    while [ $(($(date +%s) - test_start_time)) -lt $((TEST_DURATION + RAMP_UP_TIME + 10)) ]; do
        local metrics=$(curl -s http://localhost:3000/api/v1/metrics 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            local timestamp=$(date +%s)
            local memory=$(echo "$metrics" | jq -r '.memoryUsage' 2>/dev/null || echo "0")
            local connections=$(echo "$metrics" | jq -r '.activeConnections' 2>/dev/null || echo "0")
            local qps=$(echo "$metrics" | jq -r '.queriesPerSecond' 2>/dev/null || echo "0")
            local avg_response=$(echo "$metrics" | jq -r '.averageResponseTime' 2>/dev/null || echo "0")
            local cache_hit=$(echo "$metrics" | jq -r '.cacheHitRatio' 2>/dev/null || echo "0")
            
            echo "$timestamp,$memory,$connections,$qps,$avg_response,$cache_hit" >> /tmp/system_metrics.csv
        fi
        
        sleep 2
    done
}

# Main load testing function
run_load_test() {
    echo -e "${BLUE}🚀 Starting load test...${NC}"
    
    # Clear previous results
    rm -f /tmp/load_test_results.csv /tmp/system_metrics.csv
    echo "user_id,successful_requests,failed_requests,avg_response_time_ms" > /tmp/load_test_results.csv
    
    # Start system monitoring in the background
    monitor_system &
    local monitor_pid=$!
    
    # Get baseline metrics before the test
    local initial_metrics=$(curl -s http://localhost:3000/api/v1/metrics)
    local initial_memory=$(echo "$initial_metrics" | jq -r '.memoryUsage' 2>/dev/null || echo "0")
    
    echo -e "${YELLOW}📊 Initial Metrics:${NC}"
    echo "   💾 Memory: ${initial_memory}MB"
    echo ""
    
    local test_start_time=$(date +%s)
    
    # Start user simulation
    for user_id in $(seq 1 $CONCURRENT_USERS); do
        # Calculate delay for smooth ramp-up
        local start_delay=$(echo "scale=2; $RAMP_UP_TIME * ($user_id - 1) / $CONCURRENT_USERS" | bc -l 2>/dev/null || echo "0")
        
        # Start user in the background
        simulate_user $user_id $start_delay &
        
        # Show progress
        if [ $((user_id % 10)) -eq 0 ]; then
            echo -e "${BLUE}👥 Users started: $user_id/$CONCURRENT_USERS${NC}"
        fi
    done
    
    echo -e "${YELLOW}⏳ Waiting for all requests to complete...${NC}"
    
    # Wait for all users to finish
    wait
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    
    local test_end_time=$(date +%s)
    local actual_test_duration=$((test_end_time - test_start_time))
    
    echo -e "${GREEN}✅ Load testing finished!${NC}"
    echo "   ⏱️ Actual time: ${actual_test_duration}s"
    echo ""
}

# Analyze results
analyze_results() {
    echo -e "${BLUE}📊 Analyzing results...${NC}"
    echo ""
    
    if [ ! -f "/tmp/load_test_results.csv" ]; then
        echo -e "${RED}❌ Results file not found${NC}"
        return 1
    fi
    
    # Analyze user results
    local total_users=$(tail -n +2 /tmp/load_test_results.csv | wc -l)
    local total_successful=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$2} END {print sum+0}')
    local total_failed=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$3} END {print sum+0}')
    local total_requests=$((total_successful + total_failed))
    local success_rate=$(echo "scale=2; $total_successful * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")
    
    # Average response
    local avg_response=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$4; count++} END {print (count>0) ? sum/count : 0}')
    
    # Throughput
    local throughput=$(echo "scale=2; $total_successful / $TEST_DURATION" | bc -l 2>/dev/null || echo "0")
    
    echo -e "${GREEN}📈 LOAD TEST RESULTS:${NC}"
    echo "=================================================="
    echo "👥 Overall Metrics:"
    echo "   • Users: $total_users"
    echo "   • Total Requests: $total_requests"
    echo "   • Successful: $total_successful"
    echo "   • Failed: $total_failed"
    echo "   • Success Rate: ${success_rate}%"
    echo ""
    echo "⚡ Performance:"
    echo "   • Average Response Time: ${avg_response}ms"
    echo "   • Throughput: ${throughput} requests/sec"
    echo ""
    
    # Analyze system metrics
    if [ -f "/tmp/system_metrics.csv" ]; then
        local max_memory=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($2>max) max=$2} END {print max+0}')
        local max_connections=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($3>max) max=$3} END {print max+0}')
        local max_qps=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($4>max) max=$4} END {print max+0}')
        local avg_cache_hit=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{sum+=$6; count++} END {print (count>0) ? sum/count : 0}')
        
        echo "🖥️ System Metrics:"
        echo "   • Peak Memory Usage: ${max_memory}MB"
        echo "   • Max Connections: $max_connections"
        echo "   • Peak QPS: ${max_qps} requests/sec"
        echo "   • Average Cache Hit Rate: ${avg_cache_hit}%"
        echo ""
    fi
    
    # Results Assessment
    echo "🎯 Results Assessment:"
    
    if (( $(echo "$success_rate >= 95" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ Excellent stability (${success_rate}% success)${NC}"
    elif (( $(echo "$success_rate >= 90" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Good stability (${success_rate}% success)${NC}"
    else
        echo -e "   ${RED}❌ Low stability (${success_rate}% success)${NC}"
    fi
    
    if (( $(echo "$avg_response <= 200" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ Excellent response time (${avg_response}ms)${NC}"
    elif (( $(echo "$avg_response <= 500" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Acceptable response time (${avg_response}ms)${NC}"
    else
        echo -e "   ${RED}❌ Slow response time (${avg_response}ms)${NC}"
    fi
    
    if (( $(echo "$throughput >= 100" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ High throughput (${throughput} req/s)${NC}"
    elif (( $(echo "$throughput >= 50" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Medium throughput (${throughput} req/s)${NC}"
    else
        echo -e "   ${RED}❌ Low throughput (${throughput} req/s)${NC}"
    fi
    
    echo "=================================================="
}

# Save detailed report
save_report() {
    local report_file="load_test_report_$(date +%Y%m%d_%H%M%S).html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Load Test Report - Enterprise MCP Database</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f8ff; padding: 20px; border-radius: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #007acc; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Load Test Report - Enterprise MCP Database</h1>
        <p><strong>Date:</strong> $(date)</p>
        <p><strong>Test Parameters:</strong> $CONCURRENT_USERS users, $REQUESTS_PER_USER requests each, ${TEST_DURATION}s duration</p>
    </div>
    
    <div class="metrics">
        <div class="metric-card">
            <h3>📊 Request Statistics</h3>
            <p><strong>Total Requests:</strong> $(($(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$2+$3} END {print sum+0}')))</p>
            <p><strong>Successful:</strong> $(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$2} END {print sum+0}')</p>
            <p><strong>Failed:</strong> $(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$3} END {print sum+0}')</p>
        </div>
        
        <div class="metric-card">
            <h3>⚡ Performance</h3>
            <p><strong>Avg Response Time:</strong> $(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$4; count++} END {print (count>0) ? sum/count : 0}')ms</p>
            <p><strong>Throughput:</strong> $(echo "scale=2; $(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$2} END {print sum+0}') / $TEST_DURATION" | bc -l 2>/dev/null) req/s</p>
        </div>
    </div>
    
    <h2>📈 Detailed Results</h2>
    <table>
        <tr><th>User ID</th><th>Successful</th><th>Failed</th><th>Avg Response (ms)</th></tr>
EOF
    
    tail -n +2 /tmp/load_test_results.csv | while IFS=',' read -r user_id successful failed avg_response; do
        echo "        <tr><td>$user_id</td><td>$successful</td><td>$failed</td><td>$avg_response</td></tr>" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF
    </table>
    
    <p><em>Generated by Enterprise MCP Database Load Testing Tool</em></p>
</body>
</html>
EOF
    
    echo -e "${GREEN}📄 Detailed report saved: $report_file${NC}"
}

# Cleanup temporary files
cleanup() {
    rm -f /tmp/load_test_results.csv /tmp/system_metrics.csv
}

# Main function
main() {
    print_header
    
    # Check dependencies
    if ! command -v bc >/dev/null 2>&1; then
        echo -e "${RED}❌ bc is not installed. Install it with: sudo apt-get install bc${NC}"
        exit 1
    }
    
    check_system
    run_load_test
    analyze_results
    save_report
    cleanup
    
    echo -e "${GREEN}🎉 Load testing completed successfully!${NC}"
}

# Trap signals for proper cleanup
trap cleanup EXIT

# Run
main "$@"