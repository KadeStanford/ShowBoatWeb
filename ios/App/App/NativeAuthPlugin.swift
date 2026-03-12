import Capacitor
import AuthenticationServices
import GoogleSignIn
import LocalAuthentication
import CryptoKit

// MARK: - Capacitor Plugin
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showLogin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissLogin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showError", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithGoogle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveBiometric", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkBiometric", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBiometric", returnType: CAPPluginReturnPromise),
    ]

    private var loginVC: NativeLoginViewController?
    private var linkCall: CAPPluginCall?
    private var linkNonce: String?

    // MARK: - Login Screen

    @objc func showLogin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Don't present if already showing
            if self.loginVC != nil { call.resolve(); return }
            let vc = NativeLoginViewController()
            vc.delegate = self
            vc.modalPresentationStyle = .fullScreen
            self.loginVC = vc
            self.bridge?.viewController?.present(vc, animated: true)
        }
        call.resolve()
    }

    @objc func dismissLogin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.loginVC?.dismiss(animated: true) { self.loginVC = nil }
        }
        call.resolve()
    }

    @objc func showError(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? "Sign in failed"
        DispatchQueue.main.async {
            self.loginVC?.showError(message)
        }
        call.resolve()
    }

    // MARK: - Standalone Sign-In (for account linking)

    @objc func signInWithApple(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.linkCall = call
            let nonce = self.randomNonceString()
            self.linkNonce = nonce
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = self.sha256(nonce)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    @objc func signInWithGoogle(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }
            guard let clientID = GoogleClientID.value else {
                call.reject("Google Sign-In not configured")
                return
            }
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            GIDSignIn.sharedInstance.signIn(withPresenting: vc) { result, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                    call.reject("Failed to get Google credentials")
                    return
                }
                call.resolve([
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString
                ])
            }
        }
    }

    // MARK: - Biometric Credential Storage

    @objc func saveBiometric(_ call: CAPPluginCall) {
        guard let email = call.getString("email"),
              let password = call.getString("password") else {
            call.reject("Missing email or password")
            return
        }
        KeychainHelper.save(email: email, password: password)
        call.resolve()
    }

    @objc func checkBiometric(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let canEval = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        let type: String
        switch context.biometryType {
        case .faceID: type = "faceID"
        case .touchID: type = "touchID"
        default: type = "none"
        }
        call.resolve([
            "available": canEval && KeychainHelper.hasCredentials(),
            "biometryType": type,
            "hasCredentials": KeychainHelper.hasCredentials()
        ])
    }

    @objc func removeBiometric(_ call: CAPPluginCall) {
        KeychainHelper.deleteCredentials()
        call.resolve()
    }

    // MARK: - Crypto helpers
    private func randomNonceString(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    private func sha256(_ input: String) -> String {
        let hash = SHA256.hash(data: Data(input.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - NativeLoginDelegate
extension NativeAuthPlugin: NativeLoginDelegate {
    func loginDidCollectCredential(method: String, data: [String: Any]) {
        notifyListeners("authCredential", data: data.merging(["method": method]) { _, new in new })
    }

    func loginDidRequestSignup() {
        notifyListeners("authNavigate", data: ["page": "signup"])
        DispatchQueue.main.async {
            self.loginVC?.dismiss(animated: true) { self.loginVC = nil }
        }
    }
}

// MARK: - Apple Auth Delegate (for standalone linking)
extension NativeAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = linkCall else { return }
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let tokenString = String(data: tokenData, encoding: .utf8),
              let nonce = linkNonce else {
            call.reject("Failed to get Apple credentials")
            linkCall = nil
            return
        }
        var result: [String: Any] = ["idToken": tokenString, "nonce": nonce]
        if let name = cred.fullName {
            let full = [name.givenName, name.familyName].compactMap { $0 }.joined(separator: " ")
            if !full.isEmpty { result["fullName"] = full }
        }
        if let email = cred.email { result["email"] = email }
        call.resolve(result)
        linkCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        linkCall?.reject(error.localizedDescription)
        linkCall = nil
    }
}

extension NativeAuthPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? UIWindow()
    }
}

// MARK: - Google Client ID Reader
enum GoogleClientID {
    static var value: String? {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let clientID = plist["CLIENT_ID"] as? String else { return nil }
        return clientID
    }
}

// MARK: - Keychain Helper
enum KeychainHelper {
    private static let service = "me.showboat.app.auth"
    private static let emailKey = "user_email"
    private static let passwordKey = "user_password"

    static func save(email: String, password: String) {
        set(key: emailKey, value: email)
        set(key: passwordKey, value: password)
    }

    static func getCredentials() -> (email: String, password: String)? {
        guard let email = get(key: emailKey), let password = get(key: passwordKey) else { return nil }
        return (email, password)
    }

    static func hasCredentials() -> Bool {
        return get(key: emailKey) != nil
    }

    static func deleteCredentials() {
        delete(key: emailKey)
        delete(key: passwordKey)
    }

    private static func set(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
