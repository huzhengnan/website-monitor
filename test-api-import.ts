const pastedText = `域名概览：
producthunt.com
USD
AI Search
Today,
US
AI Visibility
44
Mentions
2.4K
Cited Pages
4.9K
ChatGPT
1.4K
3.1K
AI Overview
262
512
AI Mode
726
1.4K
Gemini
soon
SEO
Authority Score
49
Good
Organic traffic
256.5K
+1.7%
Paid traffic
0
Ref.Domains
180K
流量比例
23%
Organic keywords
266.6K
-5.7%
Paid keywords
0
Backlinks
69.5M`;

async function testImport() {
  try {
    console.log('=== 测试 Semrush 导入 API ===\n');
    console.log('发送请求到 /api/backlink-sites/semrush-import...\n');

    const response = await fetch('http://localhost:3000/api/backlink-sites/semrush-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pastedText }),
    });

    console.log('响应状态:', response.status);
    console.log('响应 Content-Type:', response.headers.get('content-type'));

    const text = await response.text();
    console.log('原始响应 (前500字):');
    console.log(text.substring(0, 500));
    console.log('\n---\n');

    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = JSON.parse(text);
      console.log('解析后的 JSON:');
      console.log(JSON.stringify(data, null, 2));

      if (response.ok && data.success) {
        console.log('\n✓ 导入成功！');
        console.log(`  总计: ${data.data.total} 个域名`);
        console.log(`  新建: ${data.data.created} 个`);
        console.log(`  更新: ${data.data.updated} 个`);
        console.log(`  失败: ${data.data.failed} 个`);
      }
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
}

testImport();
