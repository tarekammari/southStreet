const fs = require('fs');

async function testEndpoint() {
  try {
    const res = await fetch('http://localhost:3000/api/ai/sakhr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ما هي عاصمة فرنسا' })
    });
    const data = await res.json();
    fs.writeFileSync('./endpoint_response.json', JSON.stringify(data, null, 2));
  } catch (e) {
    fs.writeFileSync('./endpoint_response.json', JSON.stringify({ error: e.message }));
  }
}

testEndpoint();
