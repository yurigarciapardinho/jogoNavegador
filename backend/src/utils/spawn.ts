import { PrismaClient } from '@prisma/client'

export const REGIONS = {
    'ALEATORIO': null,
    'NO': [-7 * Math.PI / 8, -5 * Math.PI / 8],
    'N': [-5 * Math.PI / 8, -3 * Math.PI / 8],
    'NE': [-3 * Math.PI / 8, -Math.PI / 8],
    'L': [-Math.PI / 8, Math.PI / 8],
    'SE': [Math.PI / 8, 3 * Math.PI / 8],
    'S': [3 * Math.PI / 8, 5 * Math.PI / 8],
    'SO': [5 * Math.PI / 8, 7 * Math.PI / 8],
    'O': [7 * Math.PI / 8, 9 * Math.PI / 8] // handled specially
}

export async function gerarCoordenadaSpawn(prisma: PrismaClient, regiaoKey: string): Promise<{x: number, y: number} | null> {
    const vilasOcupadas = await prisma.village.findMany({ select: { x: true, y: true } })
    const ocupadasSet = new Set(vilasOcupadas.map(v => `${v.x},${v.y}`))

    function isLivre(vx: number, vy: number) {
        if (vx < 0 || vx > 999 || vy < 0 || vy > 999) return false;
        // Verifica bloco e arredores (2 blocos de distância) para não "grudar" aldeias
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                if (ocupadasSet.has(`${vx + dx},${vy + dy}`)) {
                    return false;
                }
            }
        }
        return true;
    }

    const key = (REGIONS as any)[regiaoKey] !== undefined ? regiaoKey : 'ALEATORIO';
    const angulos = (REGIONS as any)[key];
    const CX = 500;
    const CY = 500;

    // Anéis concêntricos: do raio 3 ao raio 500
    for (let r = 3; r <= 500; r++) {
        let candidatosUnicos = new Set<string>();
        let candidatos: {x: number, y: number}[] = [];

        const passos = Math.ceil(2 * Math.PI * r);
        const stepAngle = (2 * Math.PI) / passos;

        for (let i = 0; i < passos; i++) {
            let angle = -Math.PI + i * stepAngle; // -PI to PI
            
            let dentroDaRegiao = true;
            if (angulos) {
                if (key === 'O') {
                    dentroDaRegiao = (angle >= 7 * Math.PI / 8 || angle <= -7 * Math.PI / 8);
                } else {
                    dentroDaRegiao = (angle >= angulos[0] && angle <= angulos[1]);
                }
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
            // Sorteia dentro do mesmo anel
            return candidatos[Math.floor(Math.random() * candidatos.length)];
        }
    }

    return null; // Mapa 100% lotado
}
