#!/bin/bash

# 🚀 Quick test for Enterprise Multi-MCP Smart Database System
# This script checks all major system functions

set -e  # Stop on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для красивого вывода
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

# Проверяем что система запущена
check_system() {
    print_step "🔍 Проверяем что система запущена..."
    
    if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
        print_error "Система не запущена! Запустите: npm start"
        exit 1
    fi
    
    health_status=$(curl -s http://localhost:3000/api/v1/health | jq -r '.status' 2>/dev/null)
    
    if [ "$health_status" = "healthy" ]; then
        print_success "Система работает нормально"
    else
        print_error "Система работает, но статус: $health_status"
        exit 1
    fi
}

# Тест RAG₁ - Умная загрузка данных
test_rag1_ingestion() {
    print_step "🤖 Тестируем RAG₁ - Умную загрузку данных..."
    
    # Тест 1: Загрузка пользовательских данных
    print_step "  📊 Загружаем пользовательские данные..."
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
        
        print_success "Пользовательские данные загружены"
        echo "    🎯 Классификация: $classification (уверенность: $confidence)"
        echo "    ⏱️ Время обработки: ${processing_time}ms"
    else
        print_error "Ошибка загрузки пользовательских данных"
        echo "Response: $response"
        return 1
    fi
    
    # Тест 2: Загрузка сообщений чата
    print_step "  💬 Загружаем сообщение чата..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/ingest \
        -H "Content-Type: application/json" \
        -d '{
            "data": {
                "chat_message": {
                    "messageId": "test_msg_001",
                    "content": "Тестовое сообщение для проверки системы",
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
        
        print_success "Сообщение чата загружено"
        echo "    🎯 Классификация: $classification"
        echo "    ⏱️ Время обработки: ${processing_time}ms"
    else
        print_error "Ошибка загрузки сообщения чата"
        echo "Response: $response"
        return 1
    fi
}

# Тест RAG₂ - Естественно-языковые запросы
test_rag2_queries() {
    print_step "💬 Тестируем RAG₂ - Естественно-языковые запросы..."
    
    # Тест 1: Запрос пользователей
    print_step "  👥 Запрашиваем пользователей..."
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
        
        print_success "Запрос пользователей выполнен"
        echo "    ⏱️ Время выполнения: ${execution_time}ms"
        echo "    📊 Найдено записей: $total_records"
        echo "    🧠 Интерпретация: $interpretation"
    else
        print_error "Ошибка запроса пользователей"
        echo "Response: $response"
        return 1
    fi
    
    # Тест 2: Запрос с токеном
    print_step "  🔐 Запрашиваем данные с токеном..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/query \
        -H "Content-Type: application/json" \
        -d '{
            "naturalQuery": "get messages token xyz123"
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        execution_time=$(echo $response | jq -r '.duration' 2>/dev/null)
        sources=$(echo $response | jq -r '.data.metadata.sources[]' 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
        
        print_success "Запрос с токеном выполнен"
        echo "    ⏱️ Время выполнения: ${execution_time}ms"
        echo "    🎛️ Источники данных: $sources"
    else
        print_error "Ошибка запроса с токеном"
        echo "Response: $response"
        return 1
    fi
    
    # Тест 3: Статистические запросы
    print_step "  📈 Запрашиваем статистику..."
    response=$(curl -s -X POST http://localhost:3000/api/v1/query \
        -H "Content-Type: application/json" \
        -d '{
            "naturalQuery": "show system stats for today"
        }')
    
    success=$(echo $response | jq -r '.success' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        execution_time=$(echo $response | jq -r '.duration' 2>/dev/null)
        
        print_success "Статистический запрос выполнен"
        echo "    ⏱️ Время выполнения: ${execution_time}ms"
    else
        print_error "Ошибка статистического запроса"
        echo "Response: $response"
        return 1
    fi
}

# Тест производительности
test_performance() {
    print_step "⚡ Тестируем производительность..."
    
    # Получаем текущие метрики
    metrics=$(curl -s http://localhost:3000/api/v1/metrics)
    
    memory_usage=$(echo $metrics | jq -r '.memoryUsage' 2>/dev/null)
    active_connections=$(echo $metrics | jq -r '.activeConnections' 2>/dev/null)
    cache_hit_ratio=$(echo $metrics | jq -r '.cacheHitRatio' 2>/dev/null)
    
    print_success "Метрики производительности получены"
    echo "    💾 Использование памяти: ${memory_usage}MB"
    echo "    🔗 Активные соединения: $active_connections"
    echo "    📊 Коэффициент попаданий в кеш: ${cache_hit_ratio}%"
    
    # Проверяем пороговые значения
    if [ "$memory_usage" -gt 1000 ]; then
        print_warning "Высокое использование памяти: ${memory_usage}MB"
    fi
    
    if [ "$active_connections" -gt 100 ]; then
        print_warning "Много активных соединений: $active_connections"
    fi
}

# Нагрузочный тест
load_test() {
    print_step "🔥 Выполняем нагрузочный тест (10 параллельных запросов)..."
    
    start_time=$(date +%s)
    
    # Запускаем 10 параллельных запросов
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
    
    # Ждем завершения всех запросов
    wait
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Проверяем результаты
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
    
    print_success "Нагрузочный тест завершен"
    echo "    ⏱️ Время выполнения: ${duration}s"
    echo "    ✅ Успешных запросов: ${successful_requests}/10"
    echo "    📊 Пропускная способность: $((successful_requests / duration)) запросов/сек"
    
    if [ "$successful_requests" -lt 8 ]; then
        print_warning "Низкий процент успешных запросов: ${successful_requests}/10"
    fi
}

# Главная функция
main() {
    echo -e "${BLUE}"
    echo "🚀 ========================================"
    echo "   БЫСТРЫЙ ТЕСТ ENTERPRISE MCP DATABASE"
    echo "======================================== ${NC}"
    echo ""
    
    # Проверяем зависимости
    if ! command -v curl >/dev/null 2>&1; then
        print_error "curl не установлен. Установите: sudo apt-get install curl"
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        print_error "jq не установлен. Установите: sudo apt-get install jq"
        exit 1
    fi
    
    # Выполняем тесты
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
    echo "     ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!"
    echo "======================================== ${NC}"
    echo ""
    echo "📊 Система готова к использованию!"
    echo "🌐 API доступен на: http://localhost:3000"
    echo "📖 Документация: https://ragcore.xyz"
    echo ""
}

# Запуск тестов
main "$@"