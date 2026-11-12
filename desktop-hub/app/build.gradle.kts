plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ryuk.desktophub"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ryuk.desktophub"
        minSdk = 26
        targetSdk = 34
        versionCode = 12
        versionName = "1.8.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Firma di debug così l'APK di release è subito installabile.
            // Per la pubblicazione sostituirla con una propria keystore.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.foundation.layout.ExperimentalLayoutApi"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    testOptions {
        unitTests {
            // Robolectric: le activity vengono avviate davvero nei test
            isIncludeAndroidResources = true
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core-ktx:1.6.1")
    testImplementation("androidx.test.ext:junit:1.2.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
}

// Robolectric scarica da sé l'immagine di Android e non usa le impostazioni di rete di Gradle:
// la scarica Gradle e Robolectric la usa offline.
val robolectricAndroid: Configuration by configurations.creating
dependencies {
    robolectricAndroid("org.robolectric:android-all-instrumented:14-robolectric-10818077-i6")
}
tasks.withType<Test>().configureEach {
    val jarsDir = layout.buildDirectory.dir("robolectric-jars").get().asFile
    inputs.files(robolectricAndroid)
    doFirst {
        jarsDir.mkdirs()
        robolectricAndroid.files.forEach { it.copyTo(jarsDir.resolve(it.name), overwrite = true) }
    }
    systemProperty("robolectric.offline", "true")
    systemProperty("robolectric.dependency.dir", jarsDir.absolutePath)
}
