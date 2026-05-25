export const getBuildingCost = (buildingType: string, level: number) => {
    // Custos base e tempos em segundos
    const bases: Record<string, { wood: number, clay: number, iron: number, timeSec: number }> = {
        timberCamp: { wood: 50, clay: 60, iron: 40, timeSec: 15 },
        clayPit:    { wood: 65, clay: 50, iron: 40, timeSec: 15 },
        ironMine:   { wood: 75, clay: 65, iron: 70, timeSec: 18 },
        headquarters: { wood: 90, clay: 80, iron: 70, timeSec: 30 },
        barracks:     { wood: 200, clay: 170, iron: 90, timeSec: 60 }
    }
    
    const base = bases[buildingType] || { wood: 50, clay: 50, iron: 50, timeSec: 10 }
    
    // Fator multiplicador de nível: custo = base * (1.2 ^ (nível - 1))
    const factor = Math.pow(1.2, level - 1)
    
    return {
        wood: Math.floor(base.wood * factor),
        clay: Math.floor(base.clay * factor),
        iron: Math.floor(base.iron * factor),
        timeSec: Math.floor(base.timeSec * factor)
    }
}
