#!/bin/bash

# ⚡ Load testing Enterprise Multi-MCP Smart Database System

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Параметры тестирования (можно изменить)
CONCURRENT_USERS=${1:-50}
REQUESTS_PER_USER=${2:-20}
RAMP_UP_TIME=${3:-10}
TEST_DURATION=${4:-60}

print_header() {
    echo -e "${BLUE}"
    echo "⚡ =================================================="
    echo "   НАГРУЗОЧНОЕ ТЕСТИРОВАНИЕ MCP DATABASE"
    echo "=================================================="
    echo "🔧 Параметры теста:"
    echo "   👥 Параллельных пользователей: $CONCURRENT_USERS"
    echo "   📊 Запросов на пользователя: $REQUESTS_PER_USER"
    echo "   ⏱️ Время нарастания нагрузки: ${RAMP_UP_TIME}s"
    echo "   🕐 Длительность теста: ${TEST_DURATION}s"
    echo "==================================================${NC}"
    echo ""
}

check_system() {
    echo -e "${BLUE}🔍 Проверяем готовность системы...${NC}"
    
    if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
        echo -e "${RED}❌ Система не запущена! Запустите: npm start${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Система готова к тестированию${NC}"
    echo ""
}

# Функция для генерации случайных тестовых данных
generate_test_data() {
    local user_id=$1
    local request_id=$2
    local data_type=$((RANDOM % 4))
    
    case $data_type in
        0)
            # Пользовательская активность
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
            # Сообщения чата
            echo '{
                "data": {
                    "chat_message": {
                        "messageId": "load_msg_'$user_id'_'$request_id'",
                        "content": "Тестовое сообщение от пользователя '$user_id' запрос '$request_id'",
                        "userId": "load_test_user_'$user_id'",
                        "channelId": "load_test_channel",
                        "timestamp": '$(date +%s000)'
                    }
                }
            }'
            ;;
        2)
            # Системные метрики
            echo '{
                "data": {
                    "system_metric": {
                        "metricId": "load_metric_'$user_id'_'$request_id'",
                        "name": "cpu_usage",
                        "value": '$((RANDOM % 100))',
                        "timestamp": '$(date +%s000)',
                        "source": "load_test_server_'$user_id'"
                    }
                }
            }'
            ;;
        3)
            # Лог записи
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

# Функция для выполнения запросов одним пользователем
simulate_user() {
    local user_id=$1
    local start_delay=$2
    
    # Ждем время нарастания нагрузки
    sleep $start_delay
    
    local successful_requests=0
    local failed_requests=0
    local total_response_time=0
    
    for request_id in $(seq 1 $REQUESTS_PER_USER); do
        local start_time=$(date +%s%3N)
        
        # Генерируем тестовые данные
        local test_data=$(generate_test_data $user_id $request_id)
        
        # Отправляем запрос
        local response=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/v1/ingest \
            -H "Content-Type: application/json" \
            -d "$test_data" 2>/dev/null)
        
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        total_response_time=$((total_response_time + response_time))
        
        # Проверяем успешность запроса
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
        
        # Случайная пауза между запросами (50-200ms)
        sleep 0.$((RANDOM % 150 + 50))
    done
    
    local avg_response_time=$((total_response_time / REQUESTS_PER_USER))
    
    # Записываем результаты в временный файл
    echo "$user_id,$successful_requests,$failed_requests,$avg_response_time" >> /tmp/load_test_results.csv
}

# Функция для мониторинга системы во время теста
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

# Основная функция нагрузочного тестирования
run_load_test() {
    echo -e "${BLUE}🚀 Запускаем нагрузочное тестирование...${NC}"
    
    # Очищаем предыдущие результаты
    rm -f /tmp/load_test_results.csv /tmp/system_metrics.csv
    echo "user_id,successful_requests,failed_requests,avg_response_time_ms" > /tmp/load_test_results.csv
    
    # Запускаем мониторинг системы в фоне
    monitor_system &
    local monitor_pid=$!
    
    # Получаем базовые метрики перед тестом
    local initial_metrics=$(curl -s http://localhost:3000/api/v1/metrics)
    local initial_memory=$(echo "$initial_metrics" | jq -r '.memoryUsage' 2>/dev/null || echo "0")
    
    echo -e "${YELLOW}📊 Начальные метрики:${NC}"
    echo "   💾 Память: ${initial_memory}MB"
    echo ""
    
    local test_start_time=$(date +%s)
    
    # Запускаем симуляцию пользователей
    for user_id in $(seq 1 $CONCURRENT_USERS); do
        # Рассчитываем задержку для плавного нарастания нагрузки
        local start_delay=$(echo "scale=2; $RAMP_UP_TIME * ($user_id - 1) / $CONCURRENT_USERS" | bc -l 2>/dev/null || echo "0")
        
        # Запускаем пользователя в фоне
        simulate_user $user_id $start_delay &
        
        # Показываем прогресс
        if [ $((user_id % 10)) -eq 0 ]; then
            echo -e "${BLUE}👥 Запущено пользователей: $user_id/$CONCURRENT_USERS${NC}"
        fi
    done
    
    echo -e "${YELLOW}⏳ Ожидаем завершения всех запросов...${NC}"
    
    # Ждем завершения всех пользователей
    wait
    
    # Останавливаем мониторинг
    kill $monitor_pid 2>/dev/null || true
    
    local test_end_time=$(date +%s)
    local actual_test_duration=$((test_end_time - test_start_time))
    
    echo -e "${GREEN}✅ Нагрузочное тестирование завершено!${NC}"
    echo "   ⏱️ Фактическое время: ${actual_test_duration}s"
    echo ""
}

# Анализ результатов
analyze_results() {
    echo -e "${BLUE}📊 Анализируем результаты...${NC}"
    echo ""
    
    if [ ! -f "/tmp/load_test_results.csv" ]; then
        echo -e "${RED}❌ Файл результатов не найден${NC}"
        return 1
    fi
    
    # Анализируем результаты пользователей
    local total_users=$(tail -n +2 /tmp/load_test_results.csv | wc -l)
    local total_successful=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$2} END {print sum+0}')
    local total_failed=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$3} END {print sum+0}')
    local total_requests=$((total_successful + total_failed))
    local success_rate=$(echo "scale=2; $total_successful * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")
    
    # Средний отклик
    local avg_response=$(tail -n +2 /tmp/load_test_results.csv | awk -F',' '{sum+=$4; count++} END {print (count>0) ? sum/count : 0}')
    
    # Пропускная способность
    local throughput=$(echo "scale=2; $total_successful / $TEST_DURATION" | bc -l 2>/dev/null || echo "0")
    
    echo -e "${GREEN}📈 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ:${NC}"
    echo "=================================================="
    echo "👥 Общие показатели:"
    echo "   • Пользователей: $total_users"
    echo "   • Всего запросов: $total_requests"
    echo "   • Успешных: $total_successful"
    echo "   • Неудачных: $total_failed"
    echo "   • Процент успеха: ${success_rate}%"
    echo ""
    echo "⚡ Производительность:"
    echo "   • Среднее время отклика: ${avg_response}ms"
    echo "   • Пропускная способность: ${throughput} запросов/сек"
    echo ""
    
    # Анализ системных метрик
    if [ -f "/tmp/system_metrics.csv" ]; then
        local max_memory=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($2>max) max=$2} END {print max+0}')
        local max_connections=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($3>max) max=$3} END {print max+0}')
        local max_qps=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{if($4>max) max=$4} END {print max+0}')
        local avg_cache_hit=$(tail -n +2 /tmp/system_metrics.csv | awk -F',' '{sum+=$6; count++} END {print (count>0) ? sum/count : 0}')
        
        echo "🖥️ Системные метрики:"
        echo "   • Пиковое использование памяти: ${max_memory}MB"
        echo "   • Максимум соединений: $max_connections"
        echo "   • Пиковая скорость: ${max_qps} запросов/сек"
        echo "   • Средний коэф. попаданий в кеш: ${avg_cache_hit}%"
        echo ""
    fi
    
    # Оценка результатов
    echo "🎯 Оценка результатов:"
    
    if (( $(echo "$success_rate >= 95" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ Отличная стабильность (${success_rate}% успеха)${NC}"
    elif (( $(echo "$success_rate >= 90" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Хорошая стабильность (${success_rate}% успеха)${NC}"
    else
        echo -e "   ${RED}❌ Низкая стабильность (${success_rate}% успеха)${NC}"
    fi
    
    if (( $(echo "$avg_response <= 200" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ Отличное время отклика (${avg_response}ms)${NC}"
    elif (( $(echo "$avg_response <= 500" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Приемлемое время отклика (${avg_response}ms)${NC}"
    else
        echo -e "   ${RED}❌ Медленное время отклика (${avg_response}ms)${NC}"
    fi
    
    if (( $(echo "$throughput >= 100" | bc -l 2>/dev/null) )); then
        echo -e "   ${GREEN}✅ Высокая пропускная способность (${throughput} req/s)${NC}"
    elif (( $(echo "$throughput >= 50" | bc -l 2>/dev/null) )); then
        echo -e "   ${YELLOW}⚠️ Средняя пропускная способность (${throughput} req/s)${NC}"
    else
        echo -e "   ${RED}❌ Низкая пропускная способность (${throughput} req/s)${NC}"
    fi
    
    echo "=================================================="
}

# Сохранение подробного отчета
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
    
    echo -e "${GREEN}📄 Подробный отчет сохранен: $report_file${NC}"
}

# Очистка временных файлов
cleanup() {
    rm -f /tmp/load_test_results.csv /tmp/system_metrics.csv
}

# Главная функция
main() {
    print_header
    
    # Проверяем зависимости
    if ! command -v bc >/dev/null 2>&1; then
        echo -e "${RED}❌ bc не установлен. Установите: sudo apt-get install bc${NC}"
        exit 1
    fi
    
    check_system
    run_load_test
    analyze_results
    save_report
    cleanup
    
    echo -e "${GREEN}🎉 Нагрузочное тестирование завершено успешно!${NC}"
}

# Обработка сигналов для корректного завершения
trap cleanup EXIT

# Run
main "$@"