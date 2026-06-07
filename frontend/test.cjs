const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.url().includes('/village')) {
      console.log('Response:', response.url(), response.status());
    }
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'test@test.com');
  await page.type('input[type="password"]', 'test@test.com');
  await page.click('button[type="submit"]');

  await page.waitForSelector('text/Aldeia de test');
  await page.click('text/Aldeia de test');

  await page.waitForSelector('text/Mapa');
  await page.click('text/Mapa');

  await page.waitForSelector('text/Segunda Aldeia de test');
  await page.click('text/Segunda Aldeia de test');

  await page.waitForSelector('text/Transferir');
  await page.click('text/Transferir');

  // We are at Transfer tab. Wait a bit for inputs
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('.tropaInputNumero');
    if (inputs.length > 0) {
        inputs[0].value = '1';
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await page.evaluate(() => {
     const btns = Array.from(document.querySelectorAll('button'));
     const btn = btns.find(b => b.textContent.includes('Transferir'));
     if(btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
