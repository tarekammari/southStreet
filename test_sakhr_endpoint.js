const fs = require('fs');

async function testAll() {
  const tests = [
    { name: 'Fast Taught Rituals Q&A', prompt: 'ما هي خطوات ومناسك العمرة؟' },
    { name: 'Navigation Tool to Packages', prompt: 'افتح صفحة الباقات' },
    { name: 'Morched Discovery Tool', prompt: 'من هو المرشد الديني الشيخ أحمد؟' },
    { name: 'Fast Finance CCP Taught Q&A', prompt: 'كيف يتم الدفع عبر بريدي موب أو ccp؟' }
  ];

  const results = {};

  for (const t of tests) {
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:3000/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: t.prompt })
      });
      const elapsed = Date.now() - start;
      const data = await res.json();
      results[t.name] = { elapsedMs: elapsed, status: res.status, data };
    } catch (e) {
      results[t.name] = { error: e.message };
    }
  }

  fs.writeFileSync('./endpoint_response.json', JSON.stringify(results, null, 2));
  console.log('Test completed successfully. Output written to endpoint_response.json');
}

testAll();

