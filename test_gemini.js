const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY || process.env.SAKHR_GEMINI_KEY || '';

async function runTest() {
  const log = [];
  log.push(`Testing Key: ${apiKey}`);

  // Test 1: v1beta gemini-1.5-flash with key in URL
  try {
    const res1 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hi" }] }]
        })
      }
    );
    const body1 = await res1.text();
    log.push(`Test 1 (v1beta gemini-1.5-flash ?key=) -> Status: ${res1.status}, Response: ${body1}`);
  } catch (e) {
    log.push(`Test 1 Error: ${e.message}`);
  }

  // Test 2: v1beta gemini-2.0-flash with key in URL
  try {
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hi" }] }]
        })
      }
    );
    const body2 = await res2.text();
    log.push(`Test 2 (v1beta gemini-2.0-flash ?key=) -> Status: ${res2.status}, Response: ${body2}`);
  } catch (e) {
    log.push(`Test 2 Error: ${e.message}`);
  }

  // Test 3: v1beta with Bearer token
  try {
    const res3 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hi" }] }]
        })
      }
    );
    const body3 = await res3.text();
    log.push(`Test 3 (v1beta Bearer) -> Status: ${res3.status}, Response: ${body3}`);
  } catch (e) {
    log.push(`Test 3 Error: ${e.message}`);
  }

  fs.writeFileSync('./gemini_result.txt', log.join('\n\n'), 'utf8');
  console.log("Done writing gemini_result.txt");
}

runTest();
