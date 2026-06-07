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
    private _isDestroyed: boolean = false
    
    // Variáveis para panning
    private estaArrastando = false
    private inicioArrasto = { x: 0, y: 0 }
    private onError: ((mensagem: string) => void) | null

    // God Mode (Admin)
    public godModeEnabled: boolean = false
    public onVillageMoveCb?: (villageId: string, newX: number, newY: number) => void
    public onMapClickCb?: (x: number, y: number) => void

    // Chunking
    private tamanhoBloco = 96
    public zoomLevel = 1.0
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
    private renderizadosMovimentos = new Map<string, { container: Container, grafLinha: Graphics, grafBola: Graphics, txtEmoji: Text, containerMarcador: Container }>()
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
                const containerMarcador = new Container()
                const grafBola = new Graphics()
                const txtEmoji = new Text({ text: '', style: { fontSize: 16 } })
                
                txtEmoji.anchor.set(0.5, 0.5)
                txtEmoji.y = -18

                containerMarcador.addChild(grafBola)
                containerMarcador.addChild(txtEmoji)

                container.addChild(grafLinha)
                container.addChild(containerMarcador)
                
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
                        if (mov.type === 'RETURN') label = 'Retorno (Tropas)'
                        if (mov.type === 'TRANSPORT') label = 'Transporte'
                        if (mov.type === 'TRANSPORT_RETURN') label = 'Retorno (Mercadores)'
                        if (mov.type === 'TRANSFER') label = 'Transferência'
                        this.textTooltip.text = `${label}: ${this.formatarTempo(arrivalMs - Date.now())}`
                        const bg = this.tooltipMovimento.getChildAt(0) as Graphics
                        bg.clear().roundRect(0, 0, this.textTooltip.width + 20, 30, 5).fill({ color: 0x000000, alpha: 0.8 }).stroke({ width: 1, color: 0xffffff })
                    }
                })
                container.on('pointerleave', () => {
                    if (this.tooltipMovimento) this.tooltipMovimento.visible = false
                })

                this.containerMovimentos.addChild(container)

                const ox = mov.origin.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
                const oy = mov.origin.y * this.tamanhoBloco + (this.tamanhoBloco / 2)
                const tx = mov.target.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
                const ty = mov.target.y * this.tamanhoBloco + (this.tamanhoBloco / 2)

                let corLinha = 0xff0000 // ATAQUE
                let emoji = '⚔️'
                if (mov.type === 'SUPPORT') { corLinha = 0x3b82f6; emoji = '🛡️' }
                if (mov.type === 'RETURN') { corLinha = 0xf59e0b; emoji = '🔙' }
                if (mov.type === 'TRANSPORT') { corLinha = 0x10b981; emoji = '📦' }
                if (mov.type === 'TRANSPORT_RETURN') { corLinha = 0x94a3b8; emoji = '🔄' }
                if (mov.type === 'TRANSFER') { corLinha = 0xa855f7; emoji = '🚚' }

                // Desenhar Linha Tracejada (Dashed Line) matematicamente - UMA VEZ
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
                    
                    grafLinha.moveTo(sx, sy).lineTo(ex, ey)
                    drawn += dashLength + gapLength
                }
                grafLinha.stroke({ width: 2, color: corLinha, alpha: 0.5 })

                // Desenhar Bolinha de Movimento no Marcador
                grafBola.circle(0, 0, 12).fill(corLinha).stroke({ width: 2, color: 0xffffff })

                // Configurar Emoji
                txtEmoji.text = emoji
                
                objs = { container, grafLinha, grafBola, txtEmoji, containerMarcador }
                this.renderizadosMovimentos.set(mov.id, objs)
            }

            // ATUALIZAÇÃO NO TICKER (FRAME-A-FRAME LEVE)
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

            // Apenas transladar, sem usar CPU/GPU para recalcular caminhos!
            objs.containerMarcador.x = px
            objs.containerMarcador.y = py
        })
    }

    private atualizarCamera() {
        if (this._isDestroyed || !this.aplicativo || !this.aplicativo.screen) return
        
        this.containerAldeias.scale.set(this.zoomLevel)
        this.containerMovimentos.scale.set(this.zoomLevel)
        
        if (this.bgSprite) {
            this.bgSprite.width = this.aplicativo.screen.width
            this.bgSprite.height = this.aplicativo.screen.height
            this.bgSprite.tilePosition.x = this.cameraX
            this.bgSprite.tilePosition.y = this.cameraY
            this.bgSprite.tileScale.set(this.zoomLevel)
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
            if (this._isDestroyed) return; // Proteção contra race condition

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

    public redefinirZoom() {
        this.zoomLevel = 1.0;
        this.atualizarCamera();
    }

    public focarNaCoordenada(x: number, y: number) {
        if (this._isDestroyed || !this.aplicativo || !this.aplicativo.screen) return
        this.cameraX = (this.aplicativo.screen.width / 2) - ((x * this.tamanhoBloco + (this.tamanhoBloco / 2)) * this.zoomLevel)
        this.cameraY = (this.aplicativo.screen.height / 2) - ((y * this.tamanhoBloco + (this.tamanhoBloco / 2)) * this.zoomLevel)
        this.lastFetchTime = 0 // Força o fetch dos chunks da nova região
        this.atualizarCamera()
    }

    public definirAldeiaAtiva(x: number, y: number) {
        this.minhaAldeiaX = x;
        this.minhaAldeiaY = y;
    }

    public focarNaAldeiaAtiva() {
        if (this._isDestroyed || !this.aplicativo || !this.aplicativo.screen) return
        if (this.minhaAldeiaX === 0 && this.minhaAldeiaY === 0) {
            this.focarNaCoordenada(500, 500)
            return
        }
        
        const alvoX = (this.aplicativo.screen.width / 2) - ((this.minhaAldeiaX * this.tamanhoBloco + (this.tamanhoBloco / 2)) * this.zoomLevel)
        const alvoY = (this.aplicativo.screen.height / 2) - ((this.minhaAldeiaY * this.tamanhoBloco + (this.tamanhoBloco / 2)) * this.zoomLevel)
        
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

    public buscarChunks = async () => {
        const agora = Date.now()
        if (agora - this.lastFetchTime < 300) return
        this.lastFetchTime = agora

        if (!this.currentToken) return

        const minX = Math.max(0, Math.floor(-this.cameraX / (this.tamanhoBloco * this.zoomLevel)) - 2)
        const maxX = Math.min(999, Math.floor((-this.cameraX + this.aplicativo.screen.width) / (this.tamanhoBloco * this.zoomLevel)) + 2)
        const minY = Math.max(0, Math.floor(-this.cameraY / (this.tamanhoBloco * this.zoomLevel)) - 2)
        const maxY = Math.min(999, Math.floor((-this.cameraY + this.aplicativo.screen.height) / (this.tamanhoBloco * this.zoomLevel)) + 2)

        try {
            const dados = await api.get(`/map?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`, this.currentToken)
            if (this._isDestroyed) return; // Proteção contra race condition
            
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

                    const containerAldeia = new Container()
                    containerAldeia.x = aldeia.x * this.tamanhoBloco + (this.tamanhoBloco / 2)
                    containerAldeia.y = aldeia.y * this.tamanhoBloco + (this.tamanhoBloco / 2)

                    const circulo = new Graphics()
                        .circle(0, 0, this.tamanhoBloco * 0.35)
                        .fill(corAldeia)
                        .stroke({ width: 2, color: 0xffffff })

                    circulo.eventMode = 'static'
                    circulo.cursor = 'pointer'
                    
                    let dragAtivo = false
                    let pointerId: number | null = null

                    circulo.on('pointerdown', (evento) => {
                        evento.stopPropagation()
                        if (this.godModeEnabled) {
                            dragAtivo = true
                            pointerId = evento.pointerId
                            containerAldeia.alpha = 0.7
                            if (this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'grabbing'
                        } else {
                            if (this.aoClicarNaAldeiaCb) this.aoClicarNaAldeiaCb(aldeia)
                        }
                    })

                    circulo.on('pointermove', (evento) => {
                        if (dragAtivo && this.godModeEnabled && evento.pointerId === pointerId) {
                            evento.stopPropagation()
                            // Atualiza a posição visualmente enquanto arrasta
                            containerAldeia.x = (evento.global.x - this.cameraX) / this.zoomLevel
                            containerAldeia.y = (evento.global.y - this.cameraY) / this.zoomLevel
                        }
                    })

                    const onPointerUp = (evento: any) => {
                        if (dragAtivo && this.godModeEnabled) {
                            evento.stopPropagation()
                            dragAtivo = false
                            pointerId = null
                            containerAldeia.alpha = 1.0
                            if (this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'default'

                            // Calcular novo X e Y em blocos
                            const novoX = Math.floor(containerAldeia.x / this.tamanhoBloco)
                            const novoY = Math.floor(containerAldeia.y / this.tamanhoBloco)

                            // Snap visual para a grid provisório
                            containerAldeia.x = novoX * this.tamanhoBloco + (this.tamanhoBloco / 2)
                            containerAldeia.y = novoY * this.tamanhoBloco + (this.tamanhoBloco / 2)

                            if (this.onVillageMoveCb) {
                                this.onVillageMoveCb(aldeia.id, novoX, novoY)
                            }
                        }
                    }

                    circulo.on('pointerup', onPointerUp)
                    circulo.on('pointerupoutside', onPointerUp)

                    const textoNome = new Text({
                        text: aldeia.name,
                        style: {
                            fontSize: 14,
                            fill: 0xffffff,
                            align: 'center',
                            fontWeight: 'bold',
                            stroke: { color: 0x000000, width: 4 },
                            dropShadow: { color: 0x000000, alpha: 0.9, distance: 2, blur: 3 }
                        }
                    })
                    textoNome.anchor.set(0.5, 0)
                    textoNome.y = (this.tamanhoBloco * 0.35) + 2 // Posicionado logo abaixo do círculo

                    containerAldeia.addChild(circulo)
                    containerAldeia.addChild(textoNome)

                    this.renderizados.set(aldeia.id, containerAldeia as any) // Mantém a compatibilidade de tipo do Map
                    this.containerAldeias.addChild(containerAldeia)
                }
            })
        } catch (erro) {
            console.error('Erro no chunk', erro)
        }
    }

    private configurarInteratividade() {
        this.aplicativo.stage.eventMode = 'static'
        this.aplicativo.stage.hitArea = this.aplicativo.screen

        if (this.aplicativo.canvas) {
            this.aplicativo.canvas.addEventListener('wheel', (e) => {
                e.preventDefault()
                // A fórmula exponencial acomoda tanto mouses de roda (saltos de 100) quanto pinch-to-zoom de touchpads (saltos fracionados)
                const fator = Math.exp(-e.deltaY * 0.002);
                let novoZoom = this.zoomLevel * fator;
                novoZoom = Math.max(0.3, Math.min(2.5, novoZoom));
                
                if (novoZoom !== this.zoomLevel) {
                    const globalX = e.offsetX;
                    const globalY = e.offsetY;
                    
                    const mundoX = (globalX - this.cameraX) / this.zoomLevel;
                    const mundoY = (globalY - this.cameraY) / this.zoomLevel;
                    
                    this.zoomLevel = novoZoom;
                    
                    this.cameraX = globalX - (mundoX * this.zoomLevel);
                    this.cameraY = globalY - (mundoY * this.zoomLevel);
                    
                    this.atualizarCamera();
                }
            }, { passive: false });
        }

        this.aplicativo.stage.on('pointerdown', (evento) => {
            // Se estiver no God Mode, e for um clique limpo no mapa (pois o circulo da aldeia daria stopPropagation)
            // vamos anotar a posição inicial de descida para ver se é só um clique ou um arrasto da câmera
            this.estaArrastando = true
            this.inicioArrasto.x = evento.global.x - this.cameraX
            this.inicioArrasto.y = evento.global.y - this.cameraY
            if (this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'grabbing'
        })

        let cameraMoveu = false
        this.aplicativo.stage.on('pointermove', (evento) => {
            if (this.estaArrastando) {
                cameraMoveu = true
                this.cameraX = evento.global.x - this.inicioArrasto.x
                this.cameraY = evento.global.y - this.inicioArrasto.y
                this.atualizarCamera()
            }
        })

        const aoSoltarPonteiro = (evento: any) => {
            this.estaArrastando = false
            if (this.aplicativo && this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'default'
            
            // Se soltou e não moveu a câmera, e o GodMode estiver on, é um clique pra criar aldeia!
            if (!cameraMoveu && this.godModeEnabled && this.onMapClickCb) {
                const globalX = evento.global.x - this.cameraX
                const globalY = evento.global.y - this.cameraY
                const blocoX = Math.floor(globalX / (this.tamanhoBloco * this.zoomLevel))
                const blocoY = Math.floor(globalY / (this.tamanhoBloco * this.zoomLevel))
                if (blocoX >= 0 && blocoX <= 999 && blocoY >= 0 && blocoY <= 999) {
                    this.onMapClickCb(blocoX, blocoY)
                }
            }
            cameraMoveu = false
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
        this._isDestroyed = true;
        if (this.aplicativo) {
            try {
                this.aplicativo.destroy(
                    { removeView: true }, 
                    { children: true, texture: true, textureSource: true, context: true }
                );
                this.aplicativo = null as any;
            } catch (erro) {}
        }
    }
}
