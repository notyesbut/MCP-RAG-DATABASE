#!/bin/bash

# 🚀 1Quick test for Enterprise Multi-MCP Smart Database System
# This script checks all major system functions

set -e  # Stop on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function for formatted output
print_step() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Check that the system is running
check_system() {
    print_step "🔍 Checking if the system is running..."
    
    if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
        print_error "System is not running! Start it with: npm start"
        exit 1
    fi
    
    health_status=$(curl -s http://localhost:3000/api/v1/health | jq -r '.status' 2>/dev/null)
    
    if [ "$health_status" = "healthy" ]; then
        print_success "System is running normally"
    else
        print_error "System is running, but status is: $health_status"
        exit 1
    fi
}

# Test RAG₁ - Smart Data Ingestion
test_rag1_ingestion() {
    print_step "🤖 Testing RAG₁ - Smart Data Ingestion..."
    
    # Test 1: Ingesting user data
    print_step "  📊 Ingesting user data..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/ingest \
        -H "Content-Type: application/json" \
        -d '{
            "data": {
                "user_login": {
                    "userId": "test_user_001",
                    "email": "test@ragcore.xyz",
                    "timestamp": '$(date +%s000)',
                    "ip": "127.0.0.1"
                }
            },
            "metadata": {
                "source": "quick_test"
            }
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        classification=$(echo $response | jq -r '.classification.domain' 2>/dev/null)
        confidence=$(echo $response | jq -r '.classification.confidence' 2>/dev/null)
        processing_time=$(echo $response | jq -r '.processingTime' 2>/dev/null)
        
        print_success "User data ingested successfully"
        echo "    🎯 Classification: $classification (confidence: $confidence)"
        echo "    ⏱️ Processing time: ${processing_time}ms"
    else
        print_error "Error ingesting user data"
        echo "Response: $response"
        return 1
    fi
    
    # Test 2: Ingesting a chat message
    print_step "  💬 Ingesting a chat message..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/ingest \
        -H "Content-Type: application/json" \
        -d '{
            "data": {
                "chat_message": {
                    "messageId": "test_msg_001",
                    "content": "Test message to check the system",
                    "userId": "test_user_001",
                    "channelId": "general",
                    "timestamp": '$(date +%s000)'
                }
            }
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        classification=$(echo $response | jq -r '.classification.domain' 2>/dev/null)
        processing_time=$(echo $response | jq -r '.processingTime' 2>/dev/null)
        
        print_success "Chat message ingested successfully"
        echo "    🎯 Classification: $classification"
        echo "    ⏱️ Processing time: ${processing_time}ms"
    else
        print_error "Error ingesting chat message"
        echo "Response: $response"
        return 1
    fi
}

# Test RAG₂ - Natural Language Queries
test_rag2_queries() {
    print_step "💬 Testing RAG₂ - Natural Language Queries..."
    
    # Test 1: Querying users
    print_step "  👥 Querying users..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/query \
        -H "Content-Type: application/json" \
        -d '{
            "naturalQuery": "show me all active users",
            "context": {
                "userId": "admin",
                "permissions": ["read_users"]
            }
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        execution_time=$(echo $response | jq -r '.duration' 2>/dev/null)
        total_records=$(echo $response | jq -r '.data.metadata.totalRecords' 2>/dev/null)
        interpretation=$(echo $response | jq -r '.insights.interpretation' 2>/dev/null)
        
        print_success "User query executed successfully"
        echo "    ⏱️ Execution time: ${execution_time}ms"
        echo "    📊 Records found: $total_records"
        echo "    🧠 Interpretation: $interpretation"
    else
        print_error "Error querying users"
        echo "Response: $response"
        return 1
    fi
    
    # Test 2: Query with a token
    print_step "  🔐 Querying data with a token..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/query \
        -H "Content-Type: application/json" \
        -d '{
            "naturalQuery": "get messages token xyz123"
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        execution_time=$(echo $response | jq -r '.duration' 2>/dev/null)
        sources=$(echo $response | jq -r '.data.metadata.sources[]' 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
        
        print_success "Query with token executed successfully"
        echo "    ⏱️ Execution time: ${execution_time}ms"
        echo "    🎛️ Data sources: $sources"
    else
        print_error "Error querying with token"
        echo "Response: $response"
        return 1
    fi
    
    # Test 3: Statistical queries
    print_step "  📈 Querying statistics..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/query \
        -H "Content-Type: application/json" \
        -d '{
            "naturalQuery": "show system stats for today"
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        execution_time=$(echo $response | jq -r '.duration' 2>/dev/null)
        
        print_success "Statistical query executed successfully"
        echo "    ⏱️ Execution time: ${execution_time}ms"
    else
        print_error "Error with statistical query"
        echo "Response: $response"
        return 1
    fi
}

# Performance Test
test_performance() {
    print_step "⚡ Testing performance..."
    
    # Get current metrics
    metrics=$(curl -s http://localhost:3000/api/v1/metrics)
    
    memory_usage=$(echo $metrics | jq -r '.memoryUsage' 2>/dev/null)
    active_connections=$(echo $metrics | jq -r '.activeConnections' 2>/dev/null)
    cache_hit_ratio=$(echo $metrics | jq -r '.cacheHitRatio' 2>/dev/null)
    
    print_success "Performance metrics retrieved successfully"
    echo "    💾 Memory usage: ${memory_usage}MB"
    echo "    🔗 Active connections: $active_connections"
    echo "    📊 Cache hit ratio: ${cache_hit_ratio}%"
    
    # Check thresholds
    if [ "$memory_usage" -gt 1000 ]; then
        print_warning "High memory usage: ${memory_usage}MB"
    fi
    
    if [ "$active_connections" -gt 100 ]; then
        print_warning "High number of active connections: $active_connections"
    fi
}

# Load Test
load_test() {
    print_step "🔥 Running load test (10 concurrent requests)..."
    
    start_time=$(date +%s)
    
    # Start 10 concurrent requests
    for i in {1..10}; do
        {
            curl -s -X POST http://localhost:3000/api/v1/ingest \
                -H "Content-Type: application/json" \
                -d '{
                    "data": {
                        "load_test": {
                            "testId": "load_'$i'",
                            "timestamp": '$(date +%s000)',
                            "value": '$RANDOM'
                        }
                    }
                }' > /tmp/load_test_$i.json
        } &
    done
    
    # Wait for all requests to complete
    wait
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Check results
    successful_requests=0
    for i in {1..10}; do
        if [ -f "/tmp/load_test_$i.json" ]; then
            success=$(jq -r '.success' /tmp/load_test_$i.json 2>/dev/null)
            if [ "$success" = "true" ]; then
                successful_requests=$((successful_requests + 1))
            fi
            rm -f /tmp/load_test_$i.json
        fi
    done
    
    print_success "Load test completed"
    echo "    ⏱️ Execution time: ${duration}s"
    echo "    ✅ Successful requests: ${successful_requests}/10"
    echo "    📊 Throughput: $((successful_requests / duration)) req/s"
    
    if [ "$successful_requests" -lt 8 ]; then
        print_warning "Low success rate: ${successful_requests}/10"
    fi
}

# Main function
main() {
    echo -e "${BLUE}"
    echo "🚀 ========================================"
    echo "   QUICK TEST ENTERPRISE MCP DATABASE"
    echo "======================================== ${NC}"
    echo ""
    
    # Check dependencies
    if ! command -v curl >/dev/null 2>&1; then
        print_error "curl is not installed. Please install it: sudo apt-get install curl"
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        print_error "jq is not installed. Please install it: sudo apt-get install jq"
        exit 1
    fi
    
    # Run tests
    check_system
    echo ""
    
    test_rag1_ingestion
    echo ""
    
    test_rag2_queries
    echo ""
    
    test_performance
    echo ""
    
    load_test
    echo ""
    
    echo -e "${GREEN}"
    echo "🎉 ========================================"
    echo "     ALL TESTS PASSED SUCCESSFULLY!"
    echo "======================================== ${NC}"
    echo ""
    echo "📊 System is ready for use!"
    echo "🌐 API available at: http://localhost:3000"
    echo "📖 Documentation: https://ragcore.xyz"
    echo ""
}

# Run tests
main "$@"
