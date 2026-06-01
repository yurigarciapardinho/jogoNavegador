import { PrismaClient } from '@prisma/client'

let cachedConfig: any = null
let lastFetchTime = 0
const CACHE_TTL_MS = 30000 // 30 segundos

/**
 * Retorna as configurações do servidor a partir do cache em memória.
 * Se o cache expirar ou não estiver preenchido, faz a busca no banco de dados.
 */
export async function obterServerConfigCached(prisma: any) {
    const agora = Date.now()
    if (!cachedConfig || (agora - lastFetchTime) > CACHE_TTL_MS) {
        cachedConfig = await prisma.serverConfig.findFirst()
        if (!cachedConfig) {
            // Cria um fallback se não existir nenhuma configuração
            cachedConfig = {
                id: 'fallback-config',
                speedMultiplier: 1.0,
                maintenanceMode: false,
                globalMessage: null
            }
        }
        lastFetchTime = agora
    }
    return cachedConfig
}

/**
 * Invalida o cache local, forçando a próxima chamada a buscar diretamente no banco.
 */
export function invalidarServerConfigCache() {
    cachedConfig = null
    lastFetchTime = 0
}
