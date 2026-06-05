export const MAX_LEVELS: Record<string, number> = {
    timberCamp: 25,
    clayPit: 25,
    ironMine: 25,
    headquarters: 25,
    barracks: 25,
    warehouse: 30,
    farm: 30,
    market: 25,
    wall: 20,
    church: 3
}

export const getBuildingCost = (buildingType: string, level: number) => {
    // Custos base e tempos em segundos
    const bases: Record<string, { wood: number, clay: number, iron: number, timeSec: number }> = {
        timberCamp: { wood: 50, clay: 60, iron: 40, timeSec: 15 },
        clayPit:    { wood: 65, clay: 50, iron: 40, timeSec: 15 },
        ironMine:   { wood: 75, clay: 65, iron: 70, timeSec: 18 },
        headquarters: { wood: 90, clay: 80, iron: 70, timeSec: 30 },
        barracks:     { wood: 90, clay: 150, iron: 220, timeSec: 60 },
        warehouse:    { wood: 60, clay: 50, iron: 40, timeSec: 12 },
        farm:         { wood: 80, clay: 80, iron: 80, timeSec: 20 },
        market:       { wood: 100, clay: 100, iron: 100, timeSec: 30 },
        wall:         { wood: 50, clay: 100, iron: 20, timeSec: 45 }
    }
    
    const base = bases[buildingType] || { wood: 50, clay: 50, iron: 50, timeSec: 10 }
    
    // Fatores de multiplicador
    const costFactor = Math.pow(1.26, Math.max(0, level - 1))
    const timeFactor = Math.pow(1.20, Math.max(0, level - 1))
    
    return {
        wood: Math.floor(base.wood * costFactor),
        clay: Math.floor(base.clay * costFactor),
        iron: Math.floor(base.iron * costFactor),
        timeSec: Math.floor(base.timeSec * timeFactor)
    }
}

export const getBaseBuildingPop = (buildingType: string): number => {
    const bases: Record<string, number> = {
        timberCamp: 5,
        clayPit: 10,
        ironMine: 10,
        headquarters: 5,
        barracks: 7,
        warehouse: 0,
        farm: 0,
        market: 20,
        wall: 5,
        church: 50
    }
    return bases[buildingType] || 5
}

export const getBuildingPopCost = (buildingType: string, level: number): number => {
    if (level === 0) return 0
    const basePop = getBaseBuildingPop(buildingType)
    // Curva idêntica a da fazenda (1.17)
    return Math.floor(basePop * Math.pow(1.17, Math.max(0, level - 1)))
}

export const getTotalUsedPopulation = async (tx: any, villageId: string): Promise<number> => {
    let currentPop = 0
    const { UNIT_STATS } = require('./unitEconomy')
    
    // Unidades na aldeia
    const currentUnits = await tx.villageUnit.findUnique({ where: { villageId } })
    if (currentUnits) {
        currentPop += (currentUnits.spear || 0) * (UNIT_STATS.spear.population || 1)
        currentPop += (currentUnits.sword || 0) * (UNIT_STATS.sword.population || 1)
        currentPop += (currentUnits.axe || 0) * (UNIT_STATS.axe.population || 1)
    }
    
    // Unidades na fila
    const queuedUnits = await tx.unitQueue.findMany({ where: { villageId, completed: false } })
    for (const q of queuedUnits) {
        const qStats = UNIT_STATS[q.unitType]
        if (qStats) currentPop += q.amount * (qStats.population || 1)
    }
    
    // Movimentos
    const movements = await tx.movement.findMany({ where: { originId: villageId, completed: false } })
    for (const m of movements) {
        currentPop += (m.spear || 0) * (UNIT_STATS.spear.population || 1)
        currentPop += (m.sword || 0) * (UNIT_STATS.sword.population || 1)
        currentPop += (m.axe || 0) * (UNIT_STATS.axe.population || 1)
    }
    
    // Apoios fora
    const supporting = await tx.supportingTroop.findMany({ where: { ownerId: villageId } })
    for (const s of supporting) {
        currentPop += (s.spear || 0) * (UNIT_STATS.spear.population || 1)
        currentPop += (s.sword || 0) * (UNIT_STATS.sword.population || 1)
        currentPop += (s.axe || 0) * (UNIT_STATS.axe.population || 1)
    }
    
    // Edifícios civis
    const buildings = await tx.villageBuilding.findUnique({ where: { villageId } })
    const BUILDINGS_VALIDOS = ['headquarters', 'timberCamp', 'clayPit', 'ironMine', 'farm', 'warehouse', 'barracks', 'market', 'wall', 'church']
    const nextLevels: Record<string, number> = {}
    
    if (buildings) {
        for (const bType of BUILDINGS_VALIDOS) {
            const bLevel = (buildings as any)[bType] || 0
            nextLevels[bType] = bLevel
            currentPop += getBuildingPopCost(bType, bLevel)
        }
    }
    
    // Fila de edifícios
    const queuedBuilds = await tx.buildingQueue.findMany({ where: { villageId, completed: false }, orderBy: { id: 'asc' } })
    for (const q of queuedBuilds) {
        const prevLvl = nextLevels[q.buildingType] || 0
        const targetLvl = q.targetLevel
        currentPop += getBuildingPopCost(q.buildingType, targetLvl) - getBuildingPopCost(q.buildingType, prevLvl)
        nextLevels[q.buildingType] = targetLvl
    }

    return currentPop
}

/**
 * Calcula os pontos totais de uma aldeia baseado nos níveis dos seus edifícios.
 */
export const calculatePoints = (buildings: any): number => {
    if (!buildings) return 0
    let points = 0
    points += (buildings.headquarters || 0) * 10
    points += (buildings.barracks || 0) * 16
    points += (buildings.timberCamp || 0) * 6
    points += (buildings.clayPit || 0) * 6
    points += (buildings.ironMine || 0) * 6
    points += (buildings.farm || 0) * 5
    points += (buildings.warehouse || 0) * 6
    points += (buildings.market || 0) * 10
    points += (buildings.wall || 0) * 8
    points += (buildings.church || 0) * 50
    return points
}

export const getWarehouseCapacity = (level: number): number => {
    return Math.floor(1000 * Math.pow(1.22, Math.max(0, level - 1)))
}

export const getFarmCapacity = (level: number): number => {
    return Math.floor(240 * Math.pow(1.17, Math.max(0, level - 1)))
}

export const getMarketCapacity = (level: number): number => {
    if (level === 0) return 0
    // O Tribal Wars base tem 1 mercador no nv 1, 235 no nv 25.
    // Usaremos uma fórmula simples: 1000 de recurso base por nível, com leve multiplicador.
    // Mas para simplificar as contas, vamos fazer os primeiros 10 níveis darem 1 mercador por nível (1000 cap).
    // Para simplificar a matemática aqui: Math.floor(1.15^level * level) * 1000
    const merchants = Math.floor(Math.pow(1.15, level - 1) * level)
    return merchants * 1000
}
