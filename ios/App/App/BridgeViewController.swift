import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Disable iOS rubber-band bounce to prevent accidental pull-to-refresh
        webView?.scrollView.bounces = false
    }
}
