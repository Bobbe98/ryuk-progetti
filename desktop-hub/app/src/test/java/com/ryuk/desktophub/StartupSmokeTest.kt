package com.ryuk.desktophub

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.annotation.Config

/**
 * Avvia davvero le schermate dell'app (Robolectric): un crash all'apertura, come quello
 * della 1.5 dovuto all'ordine di inizializzazione nel ViewModel, fa fallire il test.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class StartupSmokeTest {

    @Test
    fun mainActivityStarts() {
        Robolectric.buildActivity(MainActivity::class.java).use { controller ->
            controller.setup()
            assertFalse(controller.get().isFinishing)
        }
    }

    @Test
    fun viewModelBuildsInitialState() {
        val vm = MainViewModel(ApplicationProvider.getApplicationContext())
        assertFalse(vm.state.value.apps.isEmpty())
    }

    @Test
    fun viewerActivityStarts() {
        val intent = Intent(ApplicationProvider.getApplicationContext(), ViewerActivity::class.java)
            .putExtra(ViewerActivity.EXTRA_PASSWORD, "test1234")
        Robolectric.buildActivity(ViewerActivity::class.java, intent).use { controller ->
            controller.setup()
            assertFalse(controller.get().isFinishing)
        }
    }
}
