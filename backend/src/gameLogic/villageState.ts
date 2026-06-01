import { getWarehouseCapacity } from './economy'
import { obterServerConfigCached } from '../utils/serverConfigCache'

/**
 * Sincroniza e consolida o estado temporal de uma aldeia no banco de dados.
 * Processa filas de construções pendentes, recrutamento de tropas e produção passiva.
 * Garante que todos os recursos fiquem limitados pela capacidade máxima do Armazém.
 * 
 * @param tx Instância ou transação do cliente Prisma
 * @param villageId Identificador único da aldeia
 * @param agora Objeto Date indicando o tempo presente da consolidação
 */
export async function atualizarEstadoAldeia(tx: any, villageId: string, agora: Date): Promise<any> {
    // 1. Busca dados da aldeia, filas e boosters pendentes concorrentemente (1x RTT de rede)
    const [village, completedQueues, completedUnitQueues, activeBoosters] = await Promise.all([
        tx.village.findUnique({
            where: { id: villageId },
            include: { resources: true, buildings: true, units: true }
        }),
        tx.buildingQueue.findMany({
            where: {
                villageId,
                completed: false,
                endTime: { lte: agora }
            },
            orderBy: { endTime: 'asc' }
        }),
        tx.unitQueue.findMany({
            where: {
                villageId,
                completed: false,
                endTime: { lte: agora }
            },
            orderBy: { endTime: 'asc' }
        }),
        tx.villageBooster.findMany({
            where: { villageId, endTime: { gt: agora } }
        })
    ])

    if (!village || !village.resources || !village.buildings) {
        throw new Error(`Aldeia com id ${villageId} não encontrada ou incompleta no banco.`)
    }

    let alterouFilas = false

    // ---- Passo A: Processar Filas de Construção Pendentes ----
    if (completedQueues.length > 0) {
        alterouFilas = true
        let buildingsToUpdate = { ...village.buildings } as any
        
        for (const q of completedQueues) {
            buildingsToUpdate[q.buildingType] = q.targetLevel
            
            await tx.buildingQueue.update({
                where: { id: q.id },
                data: { completed: true }
            })
        }
        
        delete buildingsToUpdate.id
        delete buildingsToUpdate.villageId
        
        const updatedBuildings = await tx.villageBuilding.update({
            where: { villageId },
            data: buildingsToUpdate
        })
        
        village.buildings = updatedBuildings
    }

    // ---- Passo B: Processar Filas de Tropas Pendentes ----
    if (completedUnitQueues.length > 0) {
        alterouFilas = true
        let unitsToUpdate = { ...village.units } as any
        
        for (const q of completedUnitQueues) {
            unitsToUpdate[q.unitType] = (unitsToUpdate[q.unitType] || 0) + q.amount
            
            await tx.unitQueue.update({
                where: { id: q.id },
                data: { completed: true }
            })
        }
        
        delete unitsToUpdate.id
        delete unitsToUpdate.villageId
        
        const updatedUnits = await tx.villageUnit.update({
            where: { villageId },
            data: unitsToUpdate
        })
        
        village.units = updatedUnits
    }

    // ---- Passo C: Processar Geração Passiva de Recursos + Capacidade do Armazém ----
    const ultimaAtualizacao = new Date(village.resources.lastUpdate)
    const msMpassados = agora.getTime() - ultimaAtualizacao.getTime()

    // Apenas recalcula se houver progresso temporal positivo
    if (msMpassados > 0) {
        const horasPassadas = msMpassados / (1000 * 60 * 60)

        // Busca o multiplicador global de velocidade do servidor (usando o cache em memória)
        const config = await obterServerConfigCached(tx)
        const speedMultiplier = config?.speedMultiplier || 1.0

        let woodMultiplier = speedMultiplier
        let clayMultiplier = speedMultiplier
        let ironMultiplier = speedMultiplier

        for (const booster of activeBoosters) {
            if (booster.boosterType === 'ALL_RESOURCES') {
                woodMultiplier *= booster.multiplier
                clayMultiplier *= booster.multiplier
                ironMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'WOOD_PRODUCTION') {
                woodMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'CLAY_PRODUCTION') {
                clayMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'IRON_PRODUCTION') {
                ironMultiplier *= booster.multiplier
            }
        }

        const produzir = (nivel: number, mult: number) => Math.floor(300 * Math.pow(1.15, nivel)) * mult

        const novaMadeiraSemLimite = village.resources.wood + (produzir(village.buildings.timberCamp, woodMultiplier) * horasPassadas)
        const novaArgilaSemLimite  = village.resources.clay  + (produzir(village.buildings.clayPit, clayMultiplier) * horasPassadas)
        const novoFerroSemLimite   = village.resources.iron  + (produzir(village.buildings.ironMine, ironMultiplier) * horasPassadas)

        // Aplica o teto de capacidade do Armazém (Warehouse)
        const maxCapacity = getWarehouseCapacity(village.buildings.warehouse)

        const madeiraFinal = Math.min(maxCapacity, novaMadeiraSemLimite)
        const argilaFinal  = Math.min(maxCapacity, novaArgilaSemLimite)
        const ferroFinal   = Math.min(maxCapacity, novoFerroSemLimite)

        // OTIMIZAÇÃO: Só grava no banco se passou mais de 1 segundo ou se houve conclusão de fila.
        // Se foi um clique ou polling rápido (<1s), atualiza apenas em memória para o retorno da API,
        // evitando queries de escrita excessivas e ineficientes no PostgreSQL.
        if (msMpassados >= 1000 || alterouFilas) {
            const recursosAtualizados = await tx.villageResource.update({
                where: { villageId },
                data: {
                    wood:       madeiraFinal,
                    clay:       argilaFinal,
                    iron:       ferroFinal,
                    lastUpdate: agora
                }
            })
            village.resources = recursosAtualizados
        } else {
            // Apenas atualiza em memória para a resposta do endpoint
            village.resources.wood = madeiraFinal
            village.resources.clay = argilaFinal
            village.resources.iron = ferroFinal
            // Não atualiza lastUpdate no banco para acumular o tempo total no próximo ciclo
        }
    }

    return village
}
