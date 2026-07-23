const fetch = require('node-fetch');

const API_URL = 'http://localhost:4000/api/ai/chat';
const TOKEN = 'YOUR_TEST_JWT_TOKEN'; // User will replace this

async function runBenchmark() {
  console.log('--- Bắt đầu Benchmark API AI RAG ---');
  
  const testCases = [
    "Khái niệm về Trí tuệ nhân tạo là gì?",
    "So sánh thuật toán KNN và Decision Tree",
    "Trình bày ứng dụng của NLP trong y tế"
  ];

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const question = testCases[i];
    console.log(`\nĐang gửi Test Case ${i + 1}: "${question}"...`);
    
    const startTime = Date.now();
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ message: question })
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      if (response.ok) {
        console.log(`[Thành công] Thời gian phản hồi: ${latency}ms`);
        results.push({ question, latency, status: 'Success' });
      } else {
        console.log(`[Thất bại] Mã lỗi: ${response.status}`);
        results.push({ question, latency, status: `Failed (${response.status})` });
      }
    } catch (error) {
      console.log(`[Lỗi mạng] ${error.message}`);
      results.push({ question, latency: 0, status: 'Error' });
    }
  }

  console.log('\n--- KẾT QUẢ BENCHMARK ---');
  console.table(results);
  
  const successResults = results.filter(r => r.status === 'Success');
  if (successResults.length > 0) {
    const avg = successResults.reduce((sum, r) => sum + r.latency, 0) / successResults.length;
    console.log(`\n=> Thời gian phản hồi trung bình (Average Latency): ${Math.round(avg)}ms`);
  }
}

runBenchmark();
