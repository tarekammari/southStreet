plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Firebase (push for calls while the app is closed) is switched on when the
// project's google-services.json is present next to this file.
val hasFirebase = file("google-services.json").exists()
if (hasFirebase) apply(plugin = "com.google.gms.google-services")

// Release signing: a PKCS12 key kept on the build server (never in git).
val keyFile = System.getenv("SS_KEYSTORE")?.let { file(it) }

android {
    namespace = "tech.southstreet.connect"
    compileSdk = 35

    defaultConfig {
        applicationId = "tech.southstreet.connect"
        // A test build installs next to the real app (e.g. SS_APP_ID_SUFFIX=.test).
        System.getenv("SS_APP_ID_SUFFIX")?.takeIf { it.isNotBlank() }?.let { applicationIdSuffix = it }
        minSdk = 27
        targetSdk = 35
        versionCode = (System.getenv("SS_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("SS_VERSION_NAME") ?: "1.5.0"
        val origin = System.getenv("SS_ORIGIN") ?: "https://southstreet.1zayd1.tech"
        buildConfigField("String", "ORIGIN", "\"$origin\"")
        // Plain http only for a test build aimed at a local dev server (SS_ORIGIN=http://10.0.2.2:3001).
        manifestPlaceholders["cleartext"] = origin.startsWith("http://").toString()
        buildConfigField("boolean", "HAS_FIREBASE", hasFirebase.toString())
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
}
