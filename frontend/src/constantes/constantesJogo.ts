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

export const BASES_EDIFICIOS: any = {
    timberCamp: { wood: 50, clay: 60, iron: 40, timeSec: 15 },
    clayPit:    { wood: 65, clay: 50, iron: 40, timeSec: 15 },
    ironMine:   { wood: 75, clay: 65, iron: 70, timeSec: 18 },
    warehouse:  { wood: 60, clay: 50, iron: 40, timeSec: 12 },
    farm:       { wood: 80, clay: 80, iron: 80, timeSec: 20 },
    barracks:   { wood: 90, clay: 150, iron: 220, timeSec: 60 },
    market:     { wood: 100, clay: 100, iron: 100, timeSec: 30 },
    headquarters: { wood: 90, clay: 80, iron: 70, timeSec: 30 },
    wall:       { wood: 50, clay: 100, iron: 20, timeSec: 45 }
}

export const obterCustoEdificio = (tipoEdificio: string, nivel: number) => {
    const base = BASES_EDIFICIOS[tipoEdificio] || { wood: 50, clay: 50, iron: 50, timeSec: 10 }
    
    const costFactor = Math.pow(1.26, Math.max(0, nivel - 1))
    const timeFactor = Math.pow(1.20, Math.max(0, nivel - 1))
    
    return {
        madeira: Math.floor(base.wood * costFactor),
        argila: Math.floor(base.clay * costFactor),
        ferro: Math.floor(base.iron * costFactor),
        tempoSegundos: Math.floor(base.timeSec * timeFactor)
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
    return Math.floor(basePop * Math.pow(1.17, Math.max(0, level - 1)))
}

export const PROPRIEDADES_UNIDADES: any = {
    spear: { nome: 'Lanceiro', madeira: 50, argila: 30, ferro: 10, tempoSegundos: 15, speedSecPerBlock: 1080, populacao: 1 },
    sword: { nome: 'Espadachim', madeira: 30, argila: 30, ferro: 70, tempoSegundos: 25, speedSecPerBlock: 1320, populacao: 1 },
    axe:   { nome: 'Bárbaro (Machado)', madeira: 60, argila: 30, ferro: 40, tempoSegundos: 20, speedSecPerBlock: 1080, populacao: 1 }
}

export const obterPropriedadesUnidade = (tipo: string) => {
    return PROPRIEDADES_UNIDADES[tipo]
}

export const obterProducaoRecurso = (nivel: number, speedMultiplier: number = 1.0) => {
    return Math.floor(300 * Math.pow(1.16, nivel)) * speedMultiplier
}

export const obterCapacidadeArmazem = (nivel: number) => {
    return Math.floor(1000 * Math.pow(1.22, Math.max(0, nivel - 1)))
}

export const obterCapacidadeFazenda = (nivel: number) => {
    return Math.floor(240 * Math.pow(1.17, Math.max(0, nivel - 1)))
}
