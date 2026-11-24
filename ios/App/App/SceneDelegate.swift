import UIKit
import WebKit
import Capacitor

@objc(GameBridgeViewController)
class GameBridgeViewController: CAPBridgeViewController {

    private let spaceBg = UIColor(red: 5.0 / 255.0, green: 8.0 / 255.0, blue: 17.0 / 255.0, alpha: 1.0)

    override var prefersStatusBarHidden: Bool {
        return true
    }

    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        return .fade
    }

    // Defer iPadOS bottom Home-bar & top Control-Center edge swipes so bottom Joystick / buttons never misfire
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .all
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .landscape
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = spaceBg
        configurePadWebView()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        configurePadWebView()
    }

    private func configurePadWebView() {
        guard let wv = webView else { return }
        wv.isOpaque = true
        wv.backgroundColor = spaceBg
        wv.scrollView.backgroundColor = spaceBg
        wv.scrollView.bounces = false
        wv.scrollView.alwaysBounceVertical = false
        wv.scrollView.alwaysBounceHorizontal = false
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.allowsBackForwardNavigationGestures = false
        wv.inputAssistantItem.leadingBarButtonGroups = []
        wv.inputAssistantItem.trailingBarButtonGroups = []
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let win = UIWindow(windowScene: windowScene)
        win.backgroundColor = UIColor(red: 5.0 / 255.0, green: 8.0 / 255.0, blue: 17.0 / 255.0, alpha: 1.0)
        win.rootViewController = GameBridgeViewController()
        win.makeKeyAndVisible()
        self.window = win

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
