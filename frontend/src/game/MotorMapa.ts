import { Application, Container, Graphics, Assets, TilingSprite, Text } from 'pixi.js'
import { api } from '../api'

// 1. Desativa ImageBitmap ANTES de qualquer carregamento ou inicialização
Assets.setPreferences({ preferCreateImageBitmap: false });

export class MotorMapa {
    public aplicativo: Application
    private containerAldeias: Container
    private containerMovimentos: Container
    private bgSprite: TilingSprite | null = null
    public estaInicializado: boolean = false
    
    // Variáveis para panning
    private estaArrastando = false
    private inicioArrasto = { x: 0, y: 0 }
    private onError: ((mensagem: string) => void) | null

    // Chunking
    private tamanhoBloco = 64
    private cameraX = 0
    private cameraY = 0
    private lastFetchTime = 0
    private currentToken = ''
    private currentUserId = ''
    private minhaAldeiaX: number = 0
    private minhaAldeiaY: number = 0
    private isAnimating = false
    private aoClicarNaAldeiaCb?: (aldeia: any) => void
    private villageCache = new Set<string>()
    private renderizados = new Map<string, Graphics>()
    private renderizadosMovimentos = new Map<string, { container: Container, grafLinha: Graphics, grafBola: Graphics, txtEmoji: Text }>()
    private movimentosAtivos: any[] = []
    private tooltipMovimento: Container | null = null
    private textTooltip: Text | null = null
    
    constructor(onErrorCallback?: (mensagem: string) => void) {
        this.aplicativo = new Application()
        this.containerAldeias = new Container()
        this.containerMovimentos = new Container()
        this.onError = onErrorCallback || null
    }

    async inicializar(elementoContainer: HTMLDivElement) {
        await this.aplicativo.init({
            resizeTo: elementoContainer,
            background: '#020617',
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        if (elementoContainer) {
            elementoContainer.appendChild(this.aplicativo.canvas);
        }

        // Criar textura procedural do chão (2x2 blocos) para o TilingSprite
        const tempGr = new Graphics()
        tempGr.rect(0, 0, this.tamanhoBloco, this.tamanhoBloco).fill(0x2d5a27).stroke({ width: 1, color: 0x1e3f1a })
        tempGr.rect(this.tamanhoBloco, 0, this.tamanhoBloco, this.tamanhoBloco).fill(0x34692d).stroke({ width: 1, color: 0x1e3f1a })
        tempGr.rect(0, this.tamanhoBloco, this.tamanhoBloco, this.tamanhoBloco).fill(0x34692d).stroke({ width: 1, color: 0x1e3f1a })
        tempGr.rect(this.tamanhoBloco, this.tamanhoBloco, this.tamanhoBloco, this.tamanhoBloco).fill(0x2d5a27).stroke({ width: 1, color: 0x1e3f1a })
        
        const texture = this.aplicativo.renderer.generateTexture(tempGr)
        
        this.bgSprite = new TilingSprite({
            texture,
            width: this.aplicativo.screen.width,
            height: this.aplicativo.screen.height,
        })

        this.aplicativo.stage.addChild(this.bgSprite)
        this.aplicativo.stage.addChild(this.containerAldeias)
        this.aplicativo.stage.addChild(this.containerMovimentos)
        
        this.criarTooltip()
        
        let ultimaBuscaAutomatica = 0
        this.aplicativo.ticker.add(() => {
            const agora = Date.now()
            if (agora - ultimaBuscaAutomatica > 2000) {
                ultimaBuscaAutomatica = agora
                this.buscarChunks()
            }
            this.animarMovimentos()
        })

        this.configurarInteratividade()
        this.estaInicializado = true;
    }

    private criarTooltip() {
        this.tooltipMovimento = new Container()
        const bg = new Graphics().roundRect(0, 0, 160, 30, 5).fill({ color: 0x000000, alpha: 0.8 }).stroke({ width: 1, color: 0xffffff })
        this.tooltipMovimento.addChild(bg)

        this.textTooltip = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14 } })
        this.textTooltip.x = 10
        this.textTooltip.y = 5
        this.tooltipMovimento.addChild(this.textTooltip)

        this.tooltipMovimento.visible = false
        this.tooltipMovimento.zIndex = 100
        this.aplicativo.stage.addChild(this.tooltipMovimento)
    }

    private formatarTempo(ms: number) {
        if (ms < 0) ms = 0
        const sec = Math.floor((ms / 1000) % 60)
        const min = Math.floor((ms / 1000 / 60) % 60)
        const hr = Math.floor((ms / 1000 / 60 / 60))
        return `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }

    private animarMovimentos = () => {
        if (!this.estaInicializado) return
        const agora = Date.now()

        const movimentosAtuais = new Set(this.movimentosAtivos.map(m => m.id))

        // Remover os que não existem mais
        for (const [id, objs] of this.renderizadosMovimentos.entries()) {
            if (!movimentosAtuais.has(id)) {
                this.containerMovimentos.removeChild(objs.container)
                objs.container.destroy({ children: true })
                this.renderizadosMovimentos.delete(id)
            }
        }

        this.movimentosAtivos.forEach((mov) => {
            let objs = this.renderizadosMovimentos.get(mov.id)
            if (!objs) {
                const container = new Container()
                container.eventMode = 'static'
                container.cursor = 'pointer'

                const grafLinha = new Graphics()
                const grafBola = new Graphics()
                const txtEmoji = new Text({ text: '', style: { fontSize: 16 } })
                
                txtEmoji.anchor.set(0.5, 0.5)

                container.addChild(grafLinha)
                container.addChild(grafBola)
                container.addChild(txtEmoji)
                
                container.on('pointerenter', () => {
                    if (this.tooltipMovimento && this.textTooltip) {
                        this.tooltipMovimento.visible = true
                    }
                })
                container.on('pointermove', (e) => {
                    if (this.tooltipMovimento && this.textTooltip) {
                        this.tooltipMovimento.x = e.global.x + 15
                        this.tooltipMovimento.y = e.global.y + 15
                        const arrivalMs = new Date(mov.arrivalTime).getTime()
                        let label = 'Ataque'
                        if (mov.type === 'SUPPORT') label = 'Apoio'
                        if (mov.type === 'RETURN') label = 'Retorno'
                        this.textTooltip.text = `${label}: ${this.formatarTempo(arrivalMs - Date.now())}`
                    }
                })
                container.on('pointerleave', () => {
                    if (this.tooltipMovimento) this.tooltipMovimento.visible = false
                })

                this.containerMovimentos.addChild(container)
                
                objs = { container, grafLinha, grafBola, txtEmoji }
                this.renderizadosMovimentos.set(mov.id, objs)
            }

            const startMs = new Date(mov.startTime).getTime()
            const arrivalMs = new Date(mov.arrivalTime).getTime()
            
            let progresso = (agora - startMs) / (arrivalMs - startMs)
            progresso = Math.max(0, Math.min(1, progresso))

            const ox = mov.origin.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
            const oy = mov.origin.y * this.tamanhoBloco + (this.tamanhoBloco / 2)
            const tx = mov.target.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
            const ty = mov.target.y * this.tamanhoBloco + (this.tamanhoBloco / 2)

            const px = ox + (tx - ox) * progresso
            const py = oy + (ty - oy) * progresso

            // Limpa gráficos
            objs.grafLinha.clear()
            objs.grafBola.clear()
            
            let corLinha = 0xff0000 // ATAQUE
            let emoji = '⚔️'
            if (mov.type === 'SUPPORT') { corLinha = 0x3b82f6; emoji = '🛡️' }
            if (mov.type === 'RETURN') { corLinha = 0xeab308; emoji = '📦' }

            // Desenhar Linha Tracejada (Dashed Line) matematicamente
            const distance = Math.hypot(tx - ox, ty - oy)
            const dashLength = 10
            const gapLength = 10
            let drawn = 0
            
            while (drawn < distance) {
                const segStart = drawn
                const segEnd = Math.min(drawn + dashLength, distance)
                
                const sx = ox + (tx - ox) * (segStart / distance)
                const sy = oy + (ty - oy) * (segStart / distance)
                const ex = ox + (tx - ox) * (segEnd / distance)
                const ey = oy + (ty - oy) * (segEnd / distance)
                
                objs.grafLinha.moveTo(sx, sy).lineTo(ex, ey)
                drawn += dashLength + gapLength
            }
            objs.grafLinha.stroke({ width: 2, color: corLinha, alpha: 0.5 })

            // Desenhar Bolinha de Movimento
            objs.grafBola.circle(px, py, 12).fill(corLinha).stroke({ width: 2, color: 0xffffff })

            // Atualizar Emoji acima da bolinha
            objs.txtEmoji.text = emoji
            objs.txtEmoji.x = px
            objs.txtEmoji.y = py - 18
        })
    }

    private atualizarCamera() {
        if (this.bgSprite) {
            this.bgSprite.width = this.aplicativo.screen.width
            this.bgSprite.height = this.aplicativo.screen.height
            this.bgSprite.tilePosition.x = this.cameraX
            this.bgSprite.tilePosition.y = this.cameraY
        }
        this.containerAldeias.x = this.cameraX
        this.containerAldeias.y = this.cameraY
        this.containerMovimentos.x = this.cameraX
        this.containerMovimentos.y = this.cameraY
        
        this.buscarChunks()
    }

    public async carregarAldeias(token: string, idUsuario: string, aoClicarNaAldeia?: (aldeia: any) => void) {
        this.currentToken = token
        this.currentUserId = idUsuario
        this.aoClicarNaAldeiaCb = aoClicarNaAldeia

        try {
            const myVillagesReq = await api.get('/me/villages', token)
            if (myVillagesReq && myVillagesReq.villages && myVillagesReq.villages.length > 0) {
                const minhaAldeia = myVillagesReq.villages[0]
                this.minhaAldeiaX = minhaAldeia.x
                this.minhaAldeiaY = minhaAldeia.y
                this.focarNaCoordenada(minhaAldeia.x, minhaAldeia.y)
            } else {
                this.focarNaCoordenada(500, 500)
            }
        } catch (e) {
            this.focarNaCoordenada(500, 500)
        }
    }

    public focarNaCoordenada(x: number, y: number) {
        if (!this.aplicativo) return
        this.cameraX = (this.aplicativo.screen.width / 2) - (x * this.tamanhoBloco)
        this.cameraY = (this.aplicativo.screen.height / 2) - (y * this.tamanhoBloco)
        this.lastFetchTime = 0 // Força o fetch dos chunks da nova região
        this.atualizarCamera()
    }

    public focarNaAldeiaAtiva() {
        if (!this.aplicativo) return
        if (this.minhaAldeiaX === 0 && this.minhaAldeiaY === 0) {
            this.focarNaCoordenada(500, 500)
            return
        }
        
        const alvoX = (this.aplicativo.screen.width / 2) - (this.minhaAldeiaX * this.tamanhoBloco)
        const alvoY = (this.aplicativo.screen.height / 2) - (this.minhaAldeiaY * this.tamanhoBloco)
        
        const distancia = Math.hypot(alvoX - this.cameraX, alvoY - this.cameraY)
        
        if (distancia > 3000) {
            // Se for muito longe (> 3000 pixels aprox 46 blocos), vai direto
            this.cameraX = alvoX
            this.cameraY = alvoY
            this.lastFetchTime = 0 // Força o fetch dos chunks da nova região
            this.atualizarCamera()
            return
        }

        if (this.isAnimating) return
        this.isAnimating = true
        
        const animar = () => {
            const diffX = alvoX - this.cameraX
            const diffY = alvoY - this.cameraY
            
            this.cameraX += diffX * 0.1
            this.cameraY += diffY * 0.1
            this.atualizarCamera()
            
            if (Math.hypot(alvoX - this.cameraX, alvoY - this.cameraY) < 2) {
                this.cameraX = alvoX
                this.cameraY = alvoY
                this.atualizarCamera()
                this.isAnimating = false
                this.aplicativo.ticker.remove(animar)
            }
        }
        
        this.aplicativo.ticker.add(animar)
    }

    private buscarChunks = async () => {
        const agora = Date.now()
        if (agora - this.lastFetchTime < 300) return
        this.lastFetchTime = agora

        if (!this.currentToken) return

        const minX = Math.max(0, Math.floor(-this.cameraX / this.tamanhoBloco) - 2)
        const maxX = Math.min(999, Math.floor((-this.cameraX + this.aplicativo.screen.width) / this.tamanhoBloco) + 2)
        const minY = Math.max(0, Math.floor(-this.cameraY / this.tamanhoBloco) - 2)
        const maxY = Math.min(999, Math.floor((-this.cameraY + this.aplicativo.screen.height) / this.tamanhoBloco) + 2)

        try {
            const dados = await api.get(`/map?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`, this.currentToken)
            if (!dados) return

            const aldeias = dados.villages || []
            this.movimentosAtivos = dados.movements || []
            
            aldeias.forEach((aldeia: any) => {
                if (!this.villageCache.has(aldeia.id)) {
                    this.villageCache.add(aldeia.id)
                    
                    let corAldeia = 0x8a8a8a 
                    if (aldeia.userId === this.currentUserId) {
                        corAldeia = 0xca8a04
                    } else if (aldeia.userId !== null) {
                        corAldeia = 0xdc2626
                    }

                    const circulo = new Graphics()
                        .circle(0, 0, this.tamanhoBloco * 0.35)
                        .fill(corAldeia)
                        .stroke({ width: 2, color: 0xffffff })

                    circulo.x = aldeia.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
                    circulo.y = aldeia.y * this.tamanhoBloco + (this.tamanhoBloco / 2)
                    
                    circulo.eventMode = 'static'
                    circulo.cursor = 'pointer'
                    circulo.on('pointerdown', (evento) => {
                        evento.stopPropagation()
                        if (this.aoClicarNaAldeiaCb) this.aoClicarNaAldeiaCb(aldeia)
                    })

                    this.renderizados.set(aldeia.id, circulo)
                    this.containerAldeias.addChild(circulo)
                }
            })
        } catch (erro) {
            console.error('Erro no chunk', erro)
        }
    }

    private configurarInteratividade() {
        this.aplicativo.stage.eventMode = 'static'
        this.aplicativo.stage.hitArea = this.aplicativo.screen

        this.aplicativo.stage.on('pointerdown', (evento) => {
            this.estaArrastando = true
            this.inicioArrasto.x = evento.global.x - this.cameraX
            this.inicioArrasto.y = evento.global.y - this.cameraY
            if (this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'grabbing'
        })

        this.aplicativo.stage.on('pointermove', (evento) => {
            if (this.estaArrastando) {
                this.cameraX = evento.global.x - this.inicioArrasto.x
                this.cameraY = evento.global.y - this.inicioArrasto.y
                this.atualizarCamera()
            }
        })

        const aoSoltarPonteiro = () => {
            this.estaArrastando = false
            if (this.aplicativo && this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'default'
            this.buscarChunks()
        }

        this.aplicativo.stage.on('pointerup', aoSoltarPonteiro)
        this.aplicativo.stage.on('pointerupoutside', aoSoltarPonteiro)
        
        this.aplicativo.renderer.on('resize', () => {
            if (this.aplicativo) {
                this.aplicativo.stage.hitArea = this.aplicativo.screen
                this.atualizarCamera()
            }
        })
    }

    destruir() {
        if (this.aplicativo) {
            try {
                this.aplicativo.destroy(
                    { removeView: true }, 
                    { children: true, texture: true, textureSource: true, context: true }
                );
            } catch (erro) {}
        }
    }
}
