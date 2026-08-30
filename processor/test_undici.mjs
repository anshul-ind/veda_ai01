try {
  const { Agent } = await import('undici');
  console.log('undici Agent available', typeof Agent);
  const agent = new Agent({ connect: { timeout: 30000 } });
  console.log('agent created');
  const res = await fetch('https://generativelanguage.googleapis.com', { dispatcher: agent });
  console.log('fetch status', res.status);
} catch (e) {
  console.error('undici test failed', e.message, e.stack?.substring(0,1000));
  try {
    const res2 = await fetch('https://generativelanguage.googleapis.com');
    console.log('plain fetch status', res2.status);
  } catch (e2) {
    console.error('plain fetch also failed', e2.message, e2.cause?.message);
  }
}
