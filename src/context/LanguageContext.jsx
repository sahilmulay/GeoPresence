import { createContext, useContext, useState, useEffect } from 'react'

const dictionary = {
  en: {
    // General
    'lang.switch': 'मराठी',
    'app.title': 'GeoPresence',
    'role.supervisor': 'Supervisor',
    'role.employee': 'Employee',
    'common.ward': 'Ward',
    
    // Navigation
    'nav.home': 'Home',
    'nav.tasks': 'Tasks',
    'nav.attendance': 'Attendance',
    'nav.map': 'Map',
    'nav.history': 'History',
    'nav.logout': 'Logout',

    // Tasks Page
    'tasks.title': 'Tasks',
    'tasks.assign_new': 'Assign a new task',
    'tasks.task_title': 'Task Title',
    'tasks.task_title_ph': 'e.g. Road Cleaning',
    'tasks.description': 'Description',
    'tasks.description_ph': 'e.g. Clean Market Area',
    'tasks.assign_employee': 'Assign Employee',
    'tasks.status': 'Status',
    'tasks.create': 'Create Task',
    'tasks.select': 'Select…',
    'tasks.all_employees': 'All Employees',
    'tasks.all_tasks': 'All Tasks',
    'tasks.all': 'All',
    'tasks.pending': 'Pending',
    'tasks.in_progress': 'In Progress',
    'tasks.completed': 'Completed',
    'tasks.no_tasks': 'No tasks here.',
    'tasks.no_employees': 'No employees in your ward yet.',
    'tasks.assigned_to': 'Assigned to',
  },
  mr: {
    // General
    'lang.switch': 'English',
    'app.title': 'जिओ प्रेझेंस (GeoPresence)',
    'role.supervisor': 'पर्यवेक्षक (Supervisor)',
    'role.employee': 'कर्मचारी (Employee)',
    'common.ward': 'वॉर्ड',
    
    // Navigation
    'nav.home': 'मुखपृष्ठ',
    'nav.tasks': 'कामे',
    'nav.attendance': 'उपस्थिती',
    'nav.map': 'नकाशा',
    'nav.history': 'इतिहास',
    'nav.logout': 'बाहेर पडा',

    // Tasks Page
    'tasks.title': 'कामे',
    'tasks.assign_new': 'नवीन काम द्या',
    'tasks.task_title': 'कामाचे नाव',
    'tasks.task_title_ph': 'उदा. रस्ता साफ करणे',
    'tasks.description': 'वर्णन',
    'tasks.description_ph': 'उदा. मार्केट परिसर साफ करा',
    'tasks.assign_employee': 'कर्मचारी निवडा',
    'tasks.status': 'स्थिती',
    'tasks.create': 'काम तयार करा',
    'tasks.select': 'निवडा…',
    'tasks.all_employees': 'सर्व कर्मचारी',
    'tasks.all_tasks': 'सर्व कामे',
    'tasks.all': 'सर्व',
    'tasks.pending': 'प्रलंबित',
    'tasks.in_progress': 'सुरू आहे',
    'tasks.completed': 'पूर्ण झाले',
    'tasks.no_tasks': 'येथे कोणतीही कामे नाहीत.',
    'tasks.no_employees': 'तुमच्या वॉर्डमध्ये अद्याप कोणतेही कर्मचारी नाहीत.',
    'tasks.assigned_to': 'कर्मचारी:',
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('gp_lang') || 'en')

  useEffect(() => {
    localStorage.setItem('gp_lang', lang)
  }, [lang])

  const t = (key) => dictionary[lang][key] || key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
