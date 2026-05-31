async function testSpawn() {
    console.log('Testando spawn radial concentric...')
    
    // Deleta vilas existentes pra ver do zero
    // await prisma.village.deleteMany()
    // We will just simulate the set instead of actually saving to DB if we want speed,
    // but the actual function reads from DB. So we MUST save to DB to test the function.
    
    // Instead of deleting the user's data, we'll just run the function in a loop and accumulate local set, but wait! The function reads from DB every time!
    // Let's modify the test to NOT touch the user's DB. We can mock it.
    
    // Fake the DB read locally for the test
    const vilasMock = new Set<string>();
    function isLivre(vx: number, vy: number) {
        if (vx < 0 || vx > 999 || vy < 0 || vy > 999) return false;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                if (vilasMock.has(`${vx + dx},${vy + dy}`)) {
                    return false;
                }
            }
        }
        return true;
    }

    const REGIONS = {
        'ALEATORIO': null,
        'NO': [-7 * Math.PI / 8, -5 * Math.PI / 8],
        'NE': [-3 * Math.PI / 8, -Math.PI / 8],
    }

    function mockSpawn(regiaoKey: string) {
        const key = (REGIONS as any)[regiaoKey] !== undefined ? regiaoKey : 'ALEATORIO';
        const angulos = (REGIONS as any)[key];
        const CX = 500;
        const CY = 500;

        for (let r = 3; r <= 500; r++) {
            let candidatosUnicos = new Set<string>();
            let candidatos: {x: number, y: number}[] = [];

            const passos = Math.ceil(2 * Math.PI * r);
            const stepAngle = (2 * Math.PI) / passos;

            for (let i = 0; i < passos; i++) {
                let angle = -Math.PI + i * stepAngle;
                
                let dentroDaRegiao = true;
                if (angulos) {
                    dentroDaRegiao = (angle >= angulos[0] && angle <= angulos[1]);
                }

                if (dentroDaRegiao) {
                    const x = Math.round(CX + r * Math.cos(angle));
                    const y = Math.round(CY + r * Math.sin(angle));
                    const keyCoords = `${x},${y}`;
                    if (!candidatosUnicos.has(keyCoords)) {
                        candidatosUnicos.add(keyCoords);
                        if (isLivre(x, y)) {
                            candidatos.push({x, y});
                        }
                    }
                }
            }

            if (candidatos.length > 0) {
                return candidatos[Math.floor(Math.random() * candidatos.length)];
            }
        }
        return null;
    }

    let noResults = []
    for(let i=0; i<10; i++) {
        const p = mockSpawn('NO')
        if (p) {
            vilasMock.add(`${p.x},${p.y}`)
            noResults.push(p)
        }
    }
    
    let neResults = []
    for(let i=0; i<10; i++) {
        const p = mockSpawn('NE')
        if (p) {
            vilasMock.add(`${p.x},${p.y}`)
            neResults.push(p)
        }
    }

    console.log('NO Spawns (Should be x<500, y<500 expanding outwards):', noResults)
    console.log('NE Spawns (Should be x>500, y<500 expanding outwards):', neResults)
}

testSpawn()
