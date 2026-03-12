import UIKit
import AuthenticationServices
import GoogleSignIn
import LocalAuthentication
import CryptoKit

// MARK: - Delegate Protocol
protocol NativeLoginDelegate: AnyObject {
    func loginDidCollectCredential(method: String, data: [String: Any])
    func loginDidRequestSignup()
}

// MARK: - NativeLoginViewController
class NativeLoginViewController: UIViewController {

    weak var delegate: NativeLoginDelegate?
    private var currentNonce: String?

    private let emailField = PaddedTextField()
    private let passwordField = PaddedTextField()
    private let errorLabel = UILabel()
    private let signInButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        let tap = UITapGestureRecognizer(target: view, action: #selector(UIView.endEditing))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    func showError(_ message: String) {
        errorLabel.text = message
        errorLabel.isHidden = false
        signInButton.isEnabled = true
        signInButton.setTitle("Sign In", for: .normal)
        view.isUserInteractionEnabled = true
    }

    // MARK: - UI Setup
    private func setupUI() {
        let bg = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1)
        let slate400 = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1)
        let indigo = UIColor(red: 99/255, green: 102/255, blue: 241/255, alpha: 1)
        let fieldBg = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1)

        view.backgroundColor = bg

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        view.addSubview(scroll)

        let content = UIView()
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            content.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)
        ])

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 60),
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -32),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: content.bottomAnchor, constant: -32)
        ])

        // Logo
        let iconLabel = UILabel()
        iconLabel.text = "📺"
        iconLabel.font = .systemFont(ofSize: 56)
        iconLabel.textAlignment = .center
        stack.addArrangedSubview(iconLabel)

        let title = UILabel()
        title.text = "ShowBoat"
        title.font = .systemFont(ofSize: 34, weight: .bold)
        title.textColor = .white
        title.textAlignment = .center
        stack.addArrangedSubview(title)

        let subtitle = UILabel()
        subtitle.text = "TV & Movies"
        subtitle.font = .systemFont(ofSize: 16, weight: .medium)
        subtitle.textColor = slate400
        subtitle.textAlignment = .center
        stack.addArrangedSubview(subtitle)

        stack.addArrangedSubview(spacer(32))

        // Face ID / Touch ID (only if biometric available + credentials saved)
        let laContext = LAContext()
        var authError: NSError?
        if laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError),
           KeychainHelper.hasCredentials() {
            let bioType = laContext.biometryType
            let iconName = bioType == .faceID ? "faceid" : "touchid"
            let label = bioType == .faceID ? "Sign in with Face ID" : "Sign in with Touch ID"
            let btn = makeButton(title: label, bg: indigo, fg: .white, systemIcon: iconName)
            btn.addTarget(self, action: #selector(biometricTapped), for: .touchUpInside)
            stack.addArrangedSubview(btn)
            stack.addArrangedSubview(spacer(4))
        }

        // Sign in with Apple
        let appleBtn = ASAuthorizationAppleIDButton(type: .signIn, style: .white)
        appleBtn.cornerRadius = 12
        appleBtn.translatesAutoresizingMaskIntoConstraints = false
        appleBtn.heightAnchor.constraint(equalToConstant: 50).isActive = true
        appleBtn.addTarget(self, action: #selector(appleTapped), for: .touchUpInside)
        stack.addArrangedSubview(appleBtn)

        // Sign in with Google
        let googleBtn = makeButton(title: "Sign in with Google", bg: .white, fg: bg, systemIcon: "g.circle.fill")
        googleBtn.addTarget(self, action: #selector(googleTapped), for: .touchUpInside)
        stack.addArrangedSubview(googleBtn)

        // Divider
        stack.addArrangedSubview(makeDivider(color: slate400))

        // Email
        configureField(emailField, placeholder: "Email", keyboard: .emailAddress, secure: false, bg: fieldBg)
        stack.addArrangedSubview(emailField)

        // Password
        configureField(passwordField, placeholder: "Password", keyboard: .default, secure: true, bg: fieldBg)
        stack.addArrangedSubview(passwordField)

        // Sign In button
        signInButton.setTitle("Sign In", for: .normal)
        signInButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        signInButton.setTitleColor(.white, for: .normal)
        signInButton.backgroundColor = indigo
        signInButton.layer.cornerRadius = 12
        signInButton.translatesAutoresizingMaskIntoConstraints = false
        signInButton.heightAnchor.constraint(equalToConstant: 50).isActive = true
        signInButton.addTarget(self, action: #selector(emailSignInTapped), for: .touchUpInside)
        stack.addArrangedSubview(signInButton)

        // Error label
        errorLabel.textColor = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1)
        errorLabel.font = .systemFont(ofSize: 14)
        errorLabel.textAlignment = .center
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true
        stack.addArrangedSubview(errorLabel)

        // Sign up row
        let signupRow = UIStackView()
        signupRow.axis = .horizontal
        signupRow.alignment = .center
        signupRow.spacing = 4

        let leadingSpacer = UIView()
        let noAccount = UILabel()
        noAccount.text = "Don't have an account?"
        noAccount.font = .systemFont(ofSize: 14)
        noAccount.textColor = slate400
        noAccount.setContentHuggingPriority(.required, for: .horizontal)

        let signupBtn = UIButton(type: .system)
        signupBtn.setTitle("Sign Up", for: .normal)
        signupBtn.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        signupBtn.tintColor = indigo
        signupBtn.addTarget(self, action: #selector(signupTapped), for: .touchUpInside)
        signupBtn.setContentHuggingPriority(.required, for: .horizontal)

        let trailingSpacer = UIView()
        signupRow.addArrangedSubview(leadingSpacer)
        signupRow.addArrangedSubview(noAccount)
        signupRow.addArrangedSubview(signupBtn)
        signupRow.addArrangedSubview(trailingSpacer)
        leadingSpacer.widthAnchor.constraint(equalTo: trailingSpacer.widthAnchor).isActive = true
        stack.addArrangedSubview(signupRow)
    }

    // MARK: - Helpers
    private func spacer(_ h: CGFloat) -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        v.heightAnchor.constraint(equalToConstant: h).isActive = true
        return v
    }

    private func makeButton(title: String, bg: UIColor, fg: UIColor, systemIcon: String) -> UIButton {
        let btn = UIButton(type: .system)
        if let img = UIImage(systemName: systemIcon) {
            btn.setImage(img.withRenderingMode(.alwaysTemplate), for: .normal)
            btn.tintColor = fg
        }
        btn.setTitle("  \(title)", for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        btn.setTitleColor(fg, for: .normal)
        btn.backgroundColor = bg
        btn.layer.cornerRadius = 12
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.heightAnchor.constraint(equalToConstant: 50).isActive = true
        return btn
    }

    private func configureField(_ field: PaddedTextField, placeholder: String, keyboard: UIKeyboardType, secure: Bool, bg: UIColor) {
        field.attributedPlaceholder = NSAttributedString(string: placeholder, attributes: [.foregroundColor: UIColor(white: 1, alpha: 0.4)])
        field.font = .systemFont(ofSize: 16)
        field.textColor = .white
        field.backgroundColor = bg
        field.layer.cornerRadius = 12
        field.keyboardType = keyboard
        field.isSecureTextEntry = secure
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.translatesAutoresizingMaskIntoConstraints = false
        field.heightAnchor.constraint(equalToConstant: 50).isActive = true
    }

    private func makeDivider(color: UIColor) -> UIView {
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false

        let line1 = UIView()
        line1.backgroundColor = color.withAlphaComponent(0.3)
        line1.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = "or"
        label.font = .systemFont(ofSize: 14)
        label.textColor = color
        label.translatesAutoresizingMaskIntoConstraints = false
        let line2 = UIView()
        line2.backgroundColor = color.withAlphaComponent(0.3)
        line2.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(line1)
        container.addSubview(label)
        container.addSubview(line2)

        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(equalToConstant: 20),
            line1.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            line1.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            line1.heightAnchor.constraint(equalToConstant: 1),
            label.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            line1.trailingAnchor.constraint(equalTo: label.leadingAnchor, constant: -12),
            line2.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 12),
            line2.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            line2.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            line2.heightAnchor.constraint(equalToConstant: 1),
        ])
        return container
    }

    // MARK: - Actions
    @objc private func appleTapped() {
        errorLabel.isHidden = true
        let nonce = randomNonceString()
        currentNonce = nonce
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    @objc private func googleTapped() {
        errorLabel.isHidden = true
        guard let clientID = GoogleClientID.value else {
            showError("Google Sign-In is not configured")
            return
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.signIn(withPresenting: self) { [weak self] result, error in
            if let error = error {
                if (error as NSError).code != -5 { // GIDSignIn cancel code
                    self?.showError(error.localizedDescription)
                }
                return
            }
            guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                self?.showError("Failed to get Google credentials")
                return
            }
            self?.delegate?.loginDidCollectCredential(method: "google", data: [
                "idToken": idToken,
                "accessToken": user.accessToken.tokenString
            ])
        }
    }

    @objc private func emailSignInTapped() {
        errorLabel.isHidden = true
        let email = (emailField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let password = passwordField.text ?? ""
        guard !email.isEmpty, !password.isEmpty else {
            showError("Please enter email and password")
            return
        }
        signInButton.isEnabled = false
        signInButton.setTitle("Signing in...", for: .normal)
        delegate?.loginDidCollectCredential(method: "email", data: [
            "email": email,
            "password": password
        ])
    }

    @objc private func biometricTapped() {
        errorLabel.isHidden = true
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Sign in to ShowBoat") { [weak self] success, error in
            DispatchQueue.main.async {
                if success, let creds = KeychainHelper.getCredentials() {
                    self?.delegate?.loginDidCollectCredential(method: "biometric", data: [
                        "email": creds.email,
                        "password": creds.password
                    ])
                } else if let error = error, (error as NSError).code != LAError.userCancel.rawValue {
                    self?.showError(error.localizedDescription)
                }
            }
        }
    }

    @objc private func signupTapped() {
        delegate?.loginDidRequestSignup()
    }

    // MARK: - Crypto helpers for Apple Sign-In
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
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

// MARK: - Apple Sign-In Delegates
extension NativeLoginViewController: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let tokenString = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            showError("Failed to get Apple ID credentials")
            return
        }
        var data: [String: Any] = ["idToken": tokenString, "nonce": nonce]
        if let name = cred.fullName {
            let full = [name.givenName, name.familyName].compactMap { $0 }.joined(separator: " ")
            if !full.isEmpty { data["fullName"] = full }
        }
        if let email = cred.email { data["email"] = email }
        delegate?.loginDidCollectCredential(method: "apple", data: data)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as NSError).code != ASAuthorizationError.canceled.rawValue {
            showError(error.localizedDescription)
        }
    }
}

extension NativeLoginViewController: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return view.window!
    }
}

// MARK: - PaddedTextField
class PaddedTextField: UITextField {
    private let inset = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
    override func textRect(forBounds bounds: CGRect) -> CGRect { bounds.inset(by: inset) }
    override func editingRect(forBounds bounds: CGRect) -> CGRect { bounds.inset(by: inset) }
    override func placeholderRect(forBounds bounds: CGRect) -> CGRect { bounds.inset(by: inset) }
}
