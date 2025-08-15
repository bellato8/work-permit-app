export default {
  nav: {
    form: 'แบบฟอร์ม',
    status: 'สถานะ',
    admin: 'ผู้ดูแล'
  },
  warning: 'สำหรับการพัฒนาเท่านั้น – ข้อมูลไม่ปลอดภัย',
  form: {
    title: 'คำขออนุญาตเข้าทำงาน',
    companyName: 'ชื่อบริษัท',
    requesterName: 'ผู้ขอ',
    contactPhone: 'เบอร์โทร',
    workArea: 'พื้นที่ทำงาน',
    floor: 'ชั้น',
    dateRange: 'ช่วงวันทำงาน',
    timeRange: 'ช่วงเวลา',
    hotWork: 'งานร้อน',
    teamMembers: 'รายชื่อผู้ร่วมงาน',
    addMember: 'เพิ่มรายชื่อ',
    remove: 'ลบ',
    equipment: 'อุปกรณ์',
    photos: 'รูปถ่าย',
    submit: 'ส่งคำขอ'
  },
  status: {
    title: 'ตรวจสอบสถานะ',
    requestId: 'เลขที่คำขอ',
    phoneSuffix: '4 หลักท้ายเบอร์',
    check: 'ตรวจสอบ'
  },
  admin: {
    title: 'แดชบอร์ดผู้ดูแล',
    filterStatus: 'กรองสถานะ'
  }
} as const;
