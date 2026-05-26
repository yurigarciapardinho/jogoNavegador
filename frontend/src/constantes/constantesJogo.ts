export const BASES_EDIFICIOS: any = {
    timberCamp: { wood: 50, clay: 60, iron: 40, timeSec: 15 },
    clayPit:    { wood: 65, clay: 50, iron: 40, timeSec: 15 },
    ironMine:   { wood: 75, clay: 65, iron: 70, timeSec: 18 }
}

export const obterCustoEdificio = (tipoEdificio: string, nivel: number) => {
    const base = BASES_EDIFICIOS[tipoEdificio] || { wood: 50, clay: 50, iron: 50, timeSec: 10 }
    const fator = Math.pow(1.2, nivel - 1)
    
    return {
        madeira: Math.floor(base.wood * fator),
        argila: Math.floor(base.clay * fator),
        ferro: Math.floor(base.iron * fator),
        tempoSegundos: Math.floor(base.timeSec * fator)
    }
}

export const PROPRIEDADES_UNIDADES: any = {
    spear: { nome: 'Lanceiro', madeira: 50, argila: 30, ferro: 10, tempoSegundos: 15 },
    sword: { nome: 'Espadachim', madeira: 30, argila: 30, ferro: 70, tempoSegundos: 25 },
    axe:   { nome: 'Bárbaro (Machado)', madeira: 60, argila: 30, ferro: 40, tempoSegundos: 20 }
}

export const obterPropriedadesUnidade = (tipo: string) => {
    return PROPRIEDADES_UNIDADES[tipo]
}
