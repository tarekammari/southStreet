async function testLlamaPollinationsPost() {
  console.log('--- Testing Pollinations POST (model=llama) ---');
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ما هي عاصمة الجزائر وما هي أكبر دولة في إفريقيا؟' }],
        model: 'llama'
      })
    });
    console.log('Status POST:', res.status);
    const text = await res.text();
    console.log('Response POST:\n', text);
  } catch (e) {
    console.error('Error POST:', e.message);
  }
}

async function testLlamaPollinationsGet() {
  console.log('\n--- Testing Pollinations GET (model=llama) ---');
  try {
    const prompt = encodeURIComponent('ما هي مساحة الجزائر وكيف يعمل الذكاء الاصطناعي؟');
    const res = await fetch(`https://text.pollinations.ai/${prompt}?model=llama`);
    console.log('Status GET:', res.status);
    const text = await res.text();
    console.log('Response GET:\n', text);
  } catch (e) {
    console.error('Error GET:', e.message);
  }
}

async function run() {
  await testLlamaPollinationsPost();
  await testLlamaPollinationsGet();
}

run();
