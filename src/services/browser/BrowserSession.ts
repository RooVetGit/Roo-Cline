import * as vscode from "vscode"
import { Browser, Page, ScreenshotOptions, TimeoutError, launch, connect } from "puppeteer"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { BrowserActionResult } from "../../shared/ExtensionMessage"
import axios from 'axios'

export class BrowserSession {
	private context: vscode.ExtensionContext
	private browser?: Browser
	private page?: Page
	private currentMousePosition?: string
	private isInteractive: boolean = false
	private browserPort: string = '7333'
	private providerRef: WeakRef<ClineProvider>

	constructor(context: vscode.ExtensionContext, provider: ClineProvider,) {
		this.context = context
		this.providerRef = new WeakRef(provider)
	}

	private async puppeteerLaunch() {
		return launch({
			args: [
    "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
			],
			defaultViewport: {
				width: 1440,
				height: 900
			},
			headless: false, // Always use non-headless mode
		})
	}

	// New method to handle browser connection
	private async puppeteerConnect(port: string): Promise<Browser | undefined> {
		try {
			this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: puppeteerConnect :: ${port}`)
		  const response = await axios.get(`http://127.0.0.1:${port}/json/version`)
		  const browserWSEndpoint = response.data.webSocketDebuggerUrl
	
		  if (!browserWSEndpoint) {
			this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: puppeteerConnect :: No webSocketDebuggerUrl found`)
			console.log("BrowserSession.ts :: puppeteerConnect :: No webSocketDebuggerUrl found")
			return undefined
		  }
	
		  return await connect({
			browserWSEndpoint,
		  })
		} catch (error) {
		  this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: puppeteerConnect :: Failed to connect: ${error}`)
		  console.log("BrowserSession.ts :: puppeteerConnect :: Failed to connect:", error)
		  return undefined
		}
	  }

	async launchBrowser(interactive: boolean = false, port?: string) {
		console.log("launch browser called")
		this.isInteractive = interactive
		this.browserPort = port ?? this.browserPort

		if (this.browser) {
			await this.closeBrowser() // this may happen when the model launches a browser again after having used it already before
		}

		if (this.isInteractive) {
			this.browser = await this.puppeteerConnect(this.browserPort)
			// If interactive mode failed, fall back to regular launch mode
			if (!this.browser) {
				this.browser = await this.puppeteerLaunch()
			}
		} else {
			this.browser = await this.puppeteerLaunch()
		}

		// TO DO: Might no longer be needed and this.page = await this.browser?.newPage() could be enough
		// Get existing pages or create new one
		const pages = await this.browser.pages()
		this.page = pages[0] || await this.browser.newPage()
		await this.page?.setViewport({ 
			width: 1440, 
			height: 900,
			deviceScaleFactor: 1,
			isMobile: false 
		  });

		return {
			screenshot: this.isInteractive ? await this.getCurrentScreenshot() : "",
			logs: this.isInteractive ?
				"Connected to browser in remote debugging mode." :
				"Browser launched successfully.",
			currentUrl: this.page?.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}

	async closeBrowser(): Promise<BrowserActionResult> {

		if(this.isInteractive) {
			console.log("disconnecting browser...")
			await this.browser?.disconnect().catch(() => {})
		} else {
			console.log("closing browser...")
			await this.browser?.close().catch(() => {})
		}
		return {}
	}

	private async getCurrentScreenshot(): Promise<string | undefined> {
		if (this.isInteractive) {
			this.browser = await this.puppeteerConnect(this.browserPort)
		  
			if (this.browser) {
				const pages = await this.browser.pages()
				this.page = pages[0] || await this.browser.newPage()
			} else {
				this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: getCurrentScreenshot :: Failed to connect to browser for screenshot`)
				throw new Error("Failed to connect to browser for screenshot")
			}
		}

		if (!this.page) {
			this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: getCurrentScreenshot :: Failed to take over a page to screenshot`)
			throw new Error("Failed to get page for screenshot")
		}

		const screenshotType ="webp"
		try {
			let screenshotBase64 = await this.page.screenshot({
				encoding: "base64",
				type: screenshotType,
			})
			return `data:image/${screenshotType};base64,${screenshotBase64}`
		} catch (err) {
			try {
				let screenshotBase64 = await this.page.screenshot({
					encoding: "base64",
					type: "png",
				})
				return `data:image/png;base64,${screenshotBase64}`
			} catch (err) {
				this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: getCurrentScreenshot :: Failed to take ${screenshotType} screenshot`)
				console.error(`Failed to take ${screenshotType} screenshot:`, err)
				return undefined
			}
		}
	}

	async doAction(action: (page: Page) => Promise<void>): Promise<BrowserActionResult> {
		try {
			if (this.isInteractive && !this.browser) {
				this.browser = await this.puppeteerConnect(this.browserPort)
				
				if (this.browser) {
				const pages = await this.browser.pages()
				this.page = pages[0] || await this.browser.newPage()
				}
			}
			// Ensure we have a browser and page
			if (!this.browser || !this.page) {
				throw new Error("Browser is not launched or connected. This may occur if the browser was automatically closed by a non-`browser_action` tool.")
			}
		
		}// For interactive mode and snapshot, try to connect first
		catch(err) {
			this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: doAction :: Browser action failed`)
			console.error("Browser action failed:", err)
			throw err
		}

		const logs: string[] = []
		let lastLogTs = Date.now()

		const consoleListener = (msg: any) => {
			if (msg.type() === "log") {
				logs.push(msg.text())
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
			lastLogTs = Date.now()
		}

		const errorListener = (err: Error) => {
			logs.push(`[Page Error] ${err.toString()}`)
			lastLogTs = Date.now()
		}

		// Add the listeners
		this.page.on("console", consoleListener)
		this.page.on("pageerror", errorListener)

		try {
			await action(this.page)
		} catch (err) {
			if (!(err instanceof TimeoutError)) {
				logs.push(`[Error] ${err.toString()}`)
			}
		}
	
		// Wait for console inactivity, with a timeout
		await pWaitFor(() => Date.now() - lastLogTs >= 500, {
			timeout: 3_000,
			interval: 100,
		}).catch(() => {})
	
		let screenshot = await this.getCurrentScreenshot()
		if (!screenshot) {
			throw new Error("Failed to take screenshot.")
		}
	
		this.page.off("console", consoleListener)
		this.page.off("pageerror", errorListener)
	
		return {
			screenshot,
			logs: logs.join("\n"),
			currentUrl: this.page.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}

	async navigateToUrl(url: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
			await this.waitTillHTMLStable(page) // in case the page is loading more resources
		})
	}

	private async waitTillHTMLStable(page: Page, timeout = 5_000) {
		const checkDurationMsecs = 500 // 1000
		const maxChecks = timeout / checkDurationMsecs
		let lastHTMLSize = 0
		let checkCounts = 1
		let countStableSizeIterations = 0
		const minStableSizeIterations = 3

		while (checkCounts++ <= maxChecks) {
			let html = await page.content()
			let currentHTMLSize = html.length

			console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)

			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				countStableSizeIterations++
			} else {
				countStableSizeIterations = 0 //reset the counter
			}

			if (countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully...")
				break
			}

			lastHTMLSize = currentHTMLSize
			await delay(checkDurationMsecs)
		}
	}

	async click(coordinate: string): Promise<BrowserActionResult> {
		const [x, y] = coordinate.split(",").map(Number)
		return this.doAction(async (page) => {
			// Set up network request monitoring
			let hasNetworkActivity = false
			const requestListener = () => {
				hasNetworkActivity = true
			}
			page.on("request", requestListener)

			// Perform the click
			await page.mouse.click(x, y)
			this.currentMousePosition = coordinate

			// Small delay to check if click triggered any network activity
			await delay(100)

			if (hasNetworkActivity) {
				// If we detected network activity, wait for navigation/loading
				await page
					.waitForNavigation({
						waitUntil: ["domcontentloaded", "networkidle2"],
						timeout: 7000,
					})
					.catch(() => {})
				await this.waitTillHTMLStable(page)
			}

			// Clean up listener
			page.off("request", requestListener)
		})
	}

	async type(text: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.keyboard.type(text)
		})
	}

	async scrollDown(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.evaluate(() => {
				window.scrollBy({
					top: 600,
					behavior: "auto",
				})
			})
			await delay(300)
		})
	}

	async scrollUp(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.evaluate(() => {
				window.scrollBy({
					top: -600,
					behavior: "auto",
				})
			})
			await delay(300)
		})
	}

	async takeScreenshot(interactive: boolean = false, port?: string): Promise<BrowserActionResult> {
		this.isInteractive = interactive
		this.browserPort = port ?? this.browserPort
		
		// If no browser session exists or we're in interactive mode, try to connect
		if ((!this.page || !this.browser) && this.isInteractive) {
		  this.browser = await this.puppeteerConnect(this.browserPort)
		  
		  if (this.browser) {
			const pages = await this.browser.pages()
			this.page = pages[0] || await this.browser.newPage()
		  } else {
			this.providerRef.deref()?.outputChannel.appendLine(`BrowserSession.ts :: takeScreenshot :: Failed to connect to browser for screenshot`)
			throw new Error("Failed to connect to browser for screenshot")
		  }
		}
	
		return this.doAction(async (page) => {
		  // doAction will handle actually taking the screenshot
		})
	}
}


