plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Firebase (push for calls while the app is closed) is switched on when the
// project's google-services.json is present next to this file.
val hasFirebase = file("google-services.json").exists()
if (hasFirebase) apply(plugin = "com.google.gms.google-services")

// Google Play edition (SS_STORE=play): updates come from Play, and src/play/AndroidManifest.xml
// takes out what Play restricts (APK installs, battery exemption, the always-on listener).
// Play needs Firebase for calls to ring while the app is closed.
val playStore = System.getenv("SS_STORE") == "play"
if (playStore && !hasFirebase) throw GradleException("SS_STORE=play needs google-services.json (Firebase)")

// Release signing: a PKCS12 key kept on the build server (never in git).
val keyFile = System.getenv("SS_KEYSTORE")?.let { file(it) }

android {
    namespace = "tech.southstreet.connect"
    compileSdk = 36

    defaultConfig {
        applicationId = "tech.southstreet.connect"
        // A test build installs next to the real app (e.g. SS_APP_ID_SUFFIX=.test).
        System.getenv("SS_APP_ID_SUFFIX")?.takeIf { it.isNotBlank() }?.let { applicationIdSuffix = it }
        // Agency build: SS_APP_SLUG=hebla → package tech.southstreet.connect.hebla and links
        // ssconnect-hebla://, so each agency's app installs next to the others and the
        // browser sign-in returns to the right one (the server's CONNECT_APP_SLUG matches it).
        val slug = System.getenv("SS_APP_SLUG")?.trim()?.lowercase()?.takeIf { it.matches(Regex("[a-z][a-z0-9]{1,20}")) }
        if (slug != null && System.getenv("SS_APP_ID_SUFFIX").isNullOrBlank()) applicationIdSuffix = ".$slug"
        val scheme = if (slug != null) "ssconnect-$slug" else "ssconnect"
        manifestPlaceholders["appScheme"] = scheme
        buildConfigField("String", "APP_SCHEME", "\"$scheme\"")
        minSdk = 27
        targetSdk = 36
        versionCode = (System.getenv("SS_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("SS_VERSION_NAME") ?: "1.5.0"
        val origin = System.getenv("SS_ORIGIN") ?: "https://southstreet.1zayd1.tech"
        buildConfigField("String", "ORIGIN", "\"$origin\"")
        // Plain http only for a test build aimed at a local dev server (SS_ORIGIN=http://10.0.2.2:3001).
        manifestPlaceholders["cleartext"] = origin.startsWith("http://").toString()
        buildConfigField("boolean", "HAS_FIREBASE", hasFirebase.toString())
        buildConfigField("boolean", "PLAY_STORE", playStore.toString())
        // Agency build (deploy/connect-agency-build.sh): the name under the icon and the
        // longer name on the call screen, notifications and the phone's calling account.
        resValue("string", "app_name", System.getenv("SS_APP_NAME")?.takeIf { it.isNotBlank() } ?: "SS Connect")
        resValue("string", "app_long_name", System.getenv("SS_APP_LONG_NAME")?.takeIf { it.isNotBlank() } ?: "South Street Connect")
    }

    signingConfigs {
        if (keyFile != null && keyFile.exists()) {
            create("release") {
                storeFile = keyFile
                storeType = "pkcs12"
                storePassword = System.getenv("SS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SS_KEY_ALIAS") ?: "connect"
                keyPassword = System.getenv("SS_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures { buildConfig = true }

    if (playStore) sourceSets.getByName("release").manifest.srcFile("src/play/AndroidManifest.xml")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.browser:browser:1.8.0")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    // Play edition: "update available" and the download, handled by Google Play itself.
    implementation("com.google.android.play:app-update-ktx:2.1.0")
}
