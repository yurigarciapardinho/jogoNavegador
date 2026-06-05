export const UNIT_STATS: Record<string, any> = {
    spear: {
        name: 'Lanceiro',
        type: 'defense',
        attack: 10,
        defense: 15,
        cost: { wood: 50, clay: 30, iron: 10 },
        baseTimeSec: 15,
        capacity: 25,
        population: 1,
        speedSecPerBlock: 1080 // 18 min
    },
    sword: {
        name: 'Espadachim',
        type: 'defense',
        attack: 25,
        defense: 50,
        cost: { wood: 30, clay: 30, iron: 70 },
        baseTimeSec: 25,
        capacity: 15,
        population: 1,
        speedSecPerBlock: 1320 // 22 min
    },
    axe: {
        name: 'Bárbaro (Machado)',
        type: 'attack',
        attack: 40,
        defense: 10,
        cost: { wood: 60, clay: 30, iron: 40 },
        baseTimeSec: 20,
        capacity: 10,
        population: 1,
        speedSecPerBlock: 1080 // 18 min
    }
}

/**
 * Retorna as propriedades de uma unidade.
 */
export const getUnitStats = (unitType: string) => {
    return UNIT_STATS[unitType] || null
}

/**
 * Calcula o tempo total de recrutamento de X unidades,
 * com base no nível atual do Quartel (Barracks).
 * A cada nível, o tempo é reduzido (ex: 5% por nível).
 */
export const getRecruitTime = (unitType: string, amount: number, barracksLevel: number): number => {
    const stats = getUnitStats(unitType)
    if (!stats) return 0
    
    // Nível 1 = 100% do tempo. Nível 2 = 95%, Nível 3 = 90%...
    const reductionFactor = Math.pow(0.95, Math.max(0, barracksLevel - 1))
    
    const timePerUnit = stats.baseTimeSec * reductionFactor
    return Math.floor(timePerUnit * amount)
}
