export default {
  nav: {
    form: 'Form',
    status: 'Status',
    admin: 'Admin'
  },
  warning: 'Development use only – data is not secure.',
  form: {
    title: 'Work Permit Request',
    companyName: 'Company Name',
    requesterName: 'Requester Name',
    contactPhone: 'Contact Phone',
    workArea: 'Work Area',
    floor: 'Floor',
    dateRange: 'Work Date Range',
    timeRange: 'Work Time Range',
    hotWork: 'Hot Work',
    teamMembers: 'Team Members',
    addMember: 'Add Member',
    remove: 'Remove',
    equipment: 'Equipment',
    photos: 'Photos',
    submit: 'Submit'
  },
  status: {
    title: 'Check Status',
    requestId: 'Request ID',
    phoneSuffix: 'Last 4 digits of phone',
    check: 'Check'
  },
  admin: {
    title: 'Admin Dashboard',
    filterStatus: 'Filter status'
  }
} as const;
