import { Application, Container, Graphics, Assets } from 'pixi.js'
import { api } from '../api'

// 1. Desativa ImageBitmap ANTES de qualquer carregamento ou inicialização
Assets.setPreferences({ preferCreateImageBitmap: false });

export class MotorMapa {
    public aplicativo: Application
    private containerMapa: Container
    public estaInicializado: boolean = false
    
    // Variáveis para panning
    private estaArrastando = false
    private inicioArrasto = { x: 0, y: 0 }
    private onError: ((mensagem: string) => void) | null
    
    constructor(onErrorCallback?: (mensagem: string) => void) {
        this.aplicativo = new Application()
        this.containerMapa = new Container()
        this.onError = onErrorCallback || null
    }

    async inicializar(elementoContainer: HTMLDivElement) {
        // 2. Inicializa o aplicativo
        await this.aplicativo.init({
            resizeTo: elementoContainer,
            background: '#020617', // var(--corFundoEscuro) do slate-950
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // 3. Anexa ao DOM de forma segura
        if (elementoContainer) {
            elementoContainer.appendChild(this.aplicativo.canvas);
        }

        this.aplicativo.stage.addChild(this.containerMapa)
        this.configurarMapa()
        this.configurarInteratividade()

        this.estaInicializado = true;
    }

    private configurarMapa() {
        const tamanhoBloco = 64
        const linhas = 20
        const colunas = 20

        for (let linha = 0; linha < linhas; linha++) {
            for (let coluna = 0; coluna < colunas; coluna++) {
                const bloco = new Graphics()
                    .rect(0, 0, tamanhoBloco, tamanhoBloco)
                    .fill((linha + coluna) % 2 === 0 ? 0x2d5a27 : 0x34692d)
                    .stroke({ width: 1, color: 0x1e3f1a })

                bloco.x = coluna * tamanhoBloco
                bloco.y = linha * tamanhoBloco
                this.containerMapa.addChild(bloco)
            }
        }

        this.containerMapa.x = this.aplicativo.screen.width / 2 - (10 * tamanhoBloco)
        this.containerMapa.y = this.aplicativo.screen.height / 2 - (10 * tamanhoBloco)
    }

    public async carregarAldeias(token: string, idUsuario: string, aoClicarNaAldeia?: (aldeia: any) => void) {
        try {
            const dados = await api.get('/map', token)
            
            if (!dados) return
            const aldeias = dados.villages || []
            const movimentos = dados.movements || []
            
            const tamanhoBloco = 64
            
            // Usando for tradicional como pede o padrão YGP (para vetores)
            for (let i = 0; i < movimentos.length; i++) {
                const movimento = movimentos[i]
                const inicioX = movimento.origin.x * tamanhoBloco + (tamanhoBloco / 2)
                const inicioY = movimento.origin.y * tamanhoBloco + (tamanhoBloco / 2)
                const fimX = movimento.target.x * tamanhoBloco + (tamanhoBloco / 2)
                const fimY = movimento.target.y * tamanhoBloco + (tamanhoBloco / 2)

                const linha = new Graphics()
                    .moveTo(inicioX, inicioY)
                    .lineTo(fimX, fimY)
                    .stroke({ width: 2, color: movimento.type === 'ATTACK' ? 0xdc2626 : 0x16a34a, alpha: 0.3 })
                this.containerMapa.addChild(linha)

                const tempoChegada = new Date(movimento.arrivalTime).getTime()
                const tempoInicio = tempoChegada - 60000 // MVP fixo: 60s
                const tempoTotal = 60000

                const pontoTropa = new Graphics()
                    .circle(0, 0, 8)
                    .fill(movimento.type === 'ATTACK' ? 0xdc2626 : 0x16a34a)
                    .stroke({ width: 2, color: 0xffffff })
                this.containerMapa.addChild(pontoTropa)

                if (this.aplicativo) {
                    this.aplicativo.ticker.add(() => {
                        const agora = Date.now()
                        if (agora >= tempoChegada) {
                            pontoTropa.alpha = 0
                            return
                        }
                        const progresso = Math.max(0, (agora - tempoInicio) / tempoTotal)
                        pontoTropa.x = inicioX + (fimX - inicioX) * progresso
                        pontoTropa.y = inicioY + (fimY - inicioY) * progresso
                        pontoTropa.alpha = 1
                    })
                }
            }

            for (let i = 0; i < aldeias.length; i++) {
                const aldeia = aldeias[i]
                let corAldeia = 0x8a8a8a 
                if (aldeia.userId === idUsuario) {
                    corAldeia = 0xca8a04 // yellow-600 do CSS
                } else if (aldeia.userId !== null) {
                    corAldeia = 0xdc2626 // red-600 do CSS
                }

                const circulo = new Graphics()
                    .circle(0, 0, tamanhoBloco * 0.35)
                    .fill(corAldeia)
                    .stroke({ width: 2, color: 0xffffff })

                circulo.x = aldeia.x * tamanhoBloco + (tamanhoBloco / 2)
                circulo.y = aldeia.y * tamanhoBloco + (tamanhoBloco / 2)
                
                circulo.eventMode = 'static'
                circulo.cursor = 'pointer'
                circulo.on('pointerdown', (evento) => {
                    evento.stopPropagation()
                    if (aoClicarNaAldeia) aoClicarNaAldeia(aldeia)
                })

                this.containerMapa.addChild(circulo)

                if (aldeia.userId === idUsuario && this.aplicativo) {
                    this.containerMapa.x = this.aplicativo.screen.width / 2 - (aldeia.x * tamanhoBloco)
                    this.containerMapa.y = this.aplicativo.screen.height / 2 - (aldeia.y * tamanhoBloco)
                }
            }
        } catch (erro) {
            if (this.onError) this.onError('Erro ao carregar mapa e aldeias.')
            console.error('Erro ao carregar mapa:', erro)
        }
    }

    private configurarInteratividade() {
        this.aplicativo.stage.eventMode = 'static'
        this.aplicativo.stage.hitArea = this.aplicativo.screen

        this.aplicativo.stage.on('pointerdown', (evento) => {
            this.estaArrastando = true
            this.inicioArrasto.x = evento.global.x - this.containerMapa.x
            this.inicioArrasto.y = evento.global.y - this.containerMapa.y
            if (this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'grabbing'
        })

        this.aplicativo.stage.on('pointermove', (evento) => {
            if (this.estaArrastando) {
                this.containerMapa.x = evento.global.x - this.inicioArrasto.x
                this.containerMapa.y = evento.global.y - this.inicioArrasto.y
            }
        })

        const aoSoltarPonteiro = () => {
            this.estaArrastando = false
            if (this.aplicativo && this.aplicativo.canvas) this.aplicativo.canvas.style.cursor = 'default'
        }

        this.aplicativo.stage.on('pointerup', aoSoltarPonteiro)
        this.aplicativo.stage.on('pointerupoutside', aoSoltarPonteiro)
        
        this.aplicativo.renderer.on('resize', () => {
            if (this.aplicativo) {
                this.aplicativo.stage.hitArea = this.aplicativo.screen
            }
        })
    }

    destruir() {
        if (this.aplicativo) {
            try {
                // Destruição completa para PixiJS v8 (limpa texturas, WebGL context, etc)
                this.aplicativo.destroy(
                    { removeView: true }, 
                    { children: true, texture: true, textureSource: true, context: true }
                );
            } catch (erro) {
                if (this.onError) this.onError('Erro ao destruir Motor Gráfico (PixiJS).')
                console.error("Erro ao destruir Pixi:", erro);
            }
        }
    }
}
