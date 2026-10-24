/**
 * TrueWire Automated Test Suite
 * Tests all 13 core requirements specified in Section 11.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'test';

const { app } = require('../server');
let server;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      port: PORT,
      host: '127.0.0.1',
      ...options
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawBody: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('--- STARTING TRUEWIRE AUTOMATED TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Start test server
  await new Promise(r => {
    server = app.listen(PORT, r);
  });

  try {
    // 1. Health check & secret leakage test
    console.log('\nTest 1: Health Diagnostics & Security (No secrets leaked)');
    const healthRes = await request({ path: '/api/health', method: 'GET' });
    assert(healthRes.status === 200, 'Health endpoint responds with HTTP 200');
    assert(healthRes.body.success === true, 'Health check indicates success');
    assert(healthRes.body.configuration !== undefined, 'Health check provides safe configuration');
    assert(!healthRes.rawBody.includes('API_KEY='), 'No API key string leaked in diagnostics');

    // 2. Fetch News with Hindi Sources
    console.log('\nTest 2: News Feed Aggregation & Hindi Support');
    const newsRes = await request({ path: '/api/news?limit=50', method: 'GET' });
    assert(newsRes.status === 200, 'News endpoint returns HTTP 200');
    assert(newsRes.body.data && newsRes.body.data.stories.length > 0, `Returned ${newsRes.body.data?.stories.length} stories`);
    const hasHindi = newsRes.body.data.stories.some(s => /[\u0900-\u097F]/.test(s.title));
    assert(hasHindi, 'Contains live stories in original Devanagari Hindi');

    // 3. Normal text claim verification
    console.log('\nTest 3: Normal Text Claim Verification');
    const normalTextRes = await request({
      path: '/api/verify/text',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { text: 'India successfully launched its satellite navigation system.' });
    assert(normalTextRes.status === 200, 'Text verify responds with HTTP 200');
    assert(normalTextRes.body.data.verdict !== undefined, `Received verdict: ${normalTextRes.body.data?.verdict}`);
    assert(typeof normalTextRes.body.data.summary === 'string', 'Summary is provided in English');

    // 4. Questionable viral Hindi headline
    console.log('\nTest 4: Viral Hindi Claim Verification');
    const hindiViralRes = await request({
      path: '/api/verify/text',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { text: 'धमाका: एलियंस ने ताजमहल के ऊपर रहस्यमयी यान उतारा, NASA ने की पुष्टि' });
    assert(hindiViralRes.status === 200, 'Hindi viral verify responds with HTTP 200');
    assert(['UNVERIFIED', 'INSUFFICIENT EVIDENCE', 'FALSE', 'MISLEADING'].includes(hindiViralRes.body.data.verdict),
      `Sensational claim correctly assessed as ${hindiViralRes.body.data.verdict}`);
    assert(/^[A-Za-z0-9\s.,'":;()\-]+$/.test(hindiViralRes.body.data.verdict), 'Verdict label is in English uppercase');

    // 5. Empty text input handling
    console.log('\nTest 5: Empty Text Input Validation');
    const emptyTextRes = await request({
      path: '/api/verify/text',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { text: '   ' });
    assert(emptyTextRes.status === 400, 'Rejects empty text with HTTP 400');
    assert(emptyTextRes.body.success === false, 'Returns success: false');

    // 6. Invalid URL & SSRF Protection
    console.log('\nTest 6: SSRF Protection & Malicious URL Rejection');
    const ssrfRes = await request({
      path: '/api/verify/link',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { url: 'http://127.0.0.1:8080/admin' });
    assert(ssrfRes.status === 400, 'Blocks loopback/private IP with HTTP 400');
    assert(ssrfRes.body.error.toLowerCase().includes('prohibited') || ssrfRes.body.error.toLowerCase().includes('guard'),
      'Returns descriptive SSRF security rejection');

    const invalidProtoRes = await request({
      path: '/api/verify/link',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { url: 'file:///etc/passwd' });
    assert(invalidProtoRes.status === 400, 'Blocks non-HTTP protocol with HTTP 400');

    // 7. Valid Link Verification
    console.log('\nTest 7: Valid Article URL Verification');
    const validLinkRes = await request({
      path: '/api/verify/link',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { url: 'https://example.com' });
    assert(validLinkRes.status === 200, 'Valid public URL processed with HTTP 200');
    assert(validLinkRes.body.article !== undefined, 'Article data successfully extracted');

    // 8. Image Upload - Unsupported File Type
    console.log('\nTest 8: Unsupported Image File Rejection');
    const fakeFileBoundary = '----WebKitFormBoundaryTest123';
    const fakeFileBody = Buffer.from(
      `--${fakeFileBoundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="exploit.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `Not an image file content\r\n` +
      `--${fakeFileBoundary}--\r\n`
    );

    const badImageRes = await request({
      path: '/api/verify/image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${fakeFileBoundary}`,
        'Content-Length': fakeFileBody.length
      }
    }, fakeFileBody);
    assert(badImageRes.status === 400, 'Unsupported file type rejected with HTTP 400');

    // 9. Image Upload - Valid PNG Signature
    console.log('\nTest 9: Valid Image Signature Verification');
    // Minimal 1x1 PNG binary buffer
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const pngHeader = Buffer.from(
      `--${fakeFileBoundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="test.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    );
    const pngFooter = Buffer.from(`\r\n--${fakeFileBoundary}--\r\n`);
    const validMultipartPayload = Buffer.concat([pngHeader, validPngBuffer, pngFooter]);

    const validImageRes = await request({
      path: '/api/verify/image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${fakeFileBoundary}`,
        'Content-Length': validMultipartPayload.length
      }
    }, validMultipartPayload);
    assert(validImageRes.status === 200, 'Valid PNG upload accepted with HTTP 200');
    assert(validImageRes.body.data.verdict !== undefined, `Image verification completed with verdict: ${validImageRes.body.data?.verdict}`);

    // 10. Search with No Matching Headlines
    console.log('\nTest 10: Local Filter with Zero Matches');
    const noMatchRes = await request({ path: '/api/news?search=xyznonexistentphrase999999', method: 'GET' });
    assert(noMatchRes.status === 200, 'Responds with HTTP 200');
    assert(noMatchRes.body.data.stories.length === 0, 'Correctly returns 0 stories for non-matching search');

    // 11. Source Filtering
    console.log('\nTest 11: Individual Source Filtering');
    const aajTakRes = await request({ path: '/api/news?source=aaj-tak', method: 'GET' });
    assert(aajTakRes.status === 200, 'Source filter responds with HTTP 200');
    assert(Array.isArray(aajTakRes.body.data.stories), 'Returns filtered stories array');

    // 12. Static Frontend Serving Check
    console.log('\nTest 12: Static Frontend HTML/CSS/JS Delivery');
    const htmlRes = await request({ path: '/', method: 'GET' });
    assert(htmlRes.status === 200, 'Serves index.html with HTTP 200');
    assert(htmlRes.rawBody.includes('TrueWire') && htmlRes.rawBody.includes('live desk'), 'Contains TrueWire / live desk brand title');
    assert(htmlRes.rawBody.includes('INDEPENDENT NEWS DESK'), 'Contains kicker tag');
    assert(htmlRes.rawBody.includes('The Verifier'), 'Contains The Verifier section');
    assert(htmlRes.rawBody.includes('Live Wire'), 'Contains Live Wire section');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test suite uncaught error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTestSuite();
