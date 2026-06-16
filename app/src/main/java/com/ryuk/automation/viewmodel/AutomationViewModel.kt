package com.ryuk.automation.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.data.repository.AutomationRepository
import com.ryuk.automation.engine.AlarmScheduler
import com.ryuk.automation.engine.AutomationEngine
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AutomationViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = AutomationRepository.get(application)
    private val engine = AutomationEngine(application)

    val automations: StateFlow<List<Automation>> = repository.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun save(automation: Automation) = viewModelScope.launch {
        repository.save(automation)
        rescheduleAlarms()
    }

    fun delete(automation: Automation) = viewModelScope.launch {
        repository.delete(automation)
        rescheduleAlarms()
    }

    fun setEnabled(automation: Automation, enabled: Boolean) = viewModelScope.launch {
        repository.setEnabled(automation.id, enabled)
        rescheduleAlarms()
    }

    fun runManually(automation: Automation) = viewModelScope.launch {
        engine.runManually(automation)
    }

    private suspend fun rescheduleAlarms() {
        AlarmScheduler.rescheduleAll(getApplication(), repository.getEnabled())
    }
}
