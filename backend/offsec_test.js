const http = require('http');

async function testVulnerabilities() {
    let tokenA = "";
    let villageAId = "";
    
    // 1. Criar e Logar Usuario A
    const email = `hacker${Date.now()}@test.com`;
    const username = `Hacker_${Date.now()}`;
    const password = "password123";
    
    await fetch('http://localhost:8080/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });
    
    // Wait for async creation
    await new Promise(r => setTimeout(r, 1000));
    
    const req2 = await fetch('http://localhost:8080/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const dataA = await req2.json();
    tokenA = dataA.token;
    
    const req3 = await fetch('http://localhost:8080/me/villages', { headers: { 'Authorization': `Bearer ${tokenA}` }});
    const villagesA = await req3.json();
    if(villagesA.length === 0) return console.log("Erro: sem vila.");
    villageAId = villagesA[0].id;

    // TESTE C: Race Condition (Tentando mandar 10 requests simultâneos para construir)
    console.log("\n[TESTE C] Race Condition: Spamming construção simultânea");
    const requests = [];
    for(let i=0; i<10; i++) {
        requests.push(fetch('http://localhost:8080/village/build', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
            body: JSON.stringify({ villageId: villageAId, buildingType: "clayPit" })
        }));
    }
    const responses = await Promise.all(requests);
    let successCount = 0;
    for(const r of responses) {
        if(r.ok) successCount++;
    }
    console.log(`    Construções iniciadas simultaneamente: ${successCount}/10 (O ideal agora é apenas 1)`);
    
}

testVulnerabilities().catch(console.error);
