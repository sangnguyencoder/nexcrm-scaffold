import { campaignService } from "@/services/campaignService";
import { customerService } from "@/services/customerService";
import { dealService } from "@/services/dealService";
import { taskService } from "@/services/taskService";
import { ticketService } from "@/services/ticketService";
import { transactionService } from "@/services/transactionService";

export const seedService = {
  async createDemoData() {
    const createdCustomers = await Promise.all([
      customerService.create({
        full_name: "Nguyễn Văn An",
        phone: "0903123456",
        email: "an.demo@nexcrm.vn",
        address: "12 Nguyễn Huệ, Quận 1",
        province: "TP. Hồ Chí Minh",
        customer_type: "vip",
        source: "direct",
      }),
      customerService.create({
        full_name: "Trần Thị Mai",
        phone: "0904455667",
        email: "mai.demo@nexcrm.vn",
        address: "88 Lê Lợi, Hải Châu",
        province: "Đà Nẵng",
        customer_type: "loyal",
        source: "marketing",
      }),
      customerService.create({
        full_name: "Lê Minh Tuấn",
        phone: "0907788991",
        email: "tuan.demo@nexcrm.vn",
        address: "102 Trần Phú, Nha Trang",
        province: "Khánh Hòa",
        customer_type: "new",
        source: "online",
      }),
    ]);

    await Promise.all([
      transactionService.create({
        customer_id: createdCustomers[0].id,
        items: [{ name: "Gói CRM Enterprise", qty: 1, price: 12_000_000, total: 12_000_000 }],
        payment_method: "transfer",
        notes: "Hợp đồng quý II",
      }),
      transactionService.create({
        customer_id: createdCustomers[1].id,
        items: [{ name: "Gói Marketing Automation", qty: 1, price: 8_500_000, total: 8_500_000 }],
        payment_method: "card",
        notes: "Mua thêm tiện ích email",
      }),
      transactionService.create({
        customer_id: createdCustomers[2].id,
        items: [{ name: "Gói Starter", qty: 1, price: 3_200_000, total: 3_200_000 }],
        payment_method: "qr",
        notes: "Khách hàng mới onboarding",
      }),
    ]);

    await Promise.all([
      ticketService.create({
        customer_id: createdCustomers[0].id,
        title: "Yêu cầu hỗ trợ tích hợp POS gấp",
        description: "Khách hàng cần đồng bộ đơn hàng trong hôm nay.",
        category: "inquiry",
        priority: "urgent",
        channel: "phone",
        status: "open",
      }),
      ticketService.create({
        customer_id: createdCustomers[1].id,
        title: "Đã xác nhận hoàn tất cấu hình chiến dịch",
        description: "Ticket kiểm tra sau triển khai.",
        category: "feedback",
        priority: "medium",
        channel: "email",
        status: "resolved",
      }),
    ]);

    const createdDeals = await Promise.all([
      dealService.create({
        title: "Gia hạn gói CRM Enterprise",
        customer_id: createdCustomers[0].id,
        stage: "negotiation",
        value: 18_000_000,
        probability: 75,
        description: "Đang chờ xác nhận PO từ khách hàng VIP.",
      }),
      dealService.create({
        title: "Upsell Marketing Automation",
        customer_id: createdCustomers[1].id,
        stage: "proposal",
        value: 9_500_000,
        probability: 55,
        description: "Đã gửi proposal và chờ phản hồi trong tuần này.",
      }),
    ]);

    await Promise.all([
      taskService.create({
        title: "Gọi xác nhận PO",
        entity_type: "deal",
        entity_id: createdDeals[0].id,
        priority: "high",
      }),
      taskService.create({
        title: "Follow-up proposal qua email",
        entity_type: "deal",
        entity_id: createdDeals[1].id,
        priority: "medium",
      }),
    ]);

    await campaignService.create({
      name: "Chiến Dịch Demo Tháng 4",
      description: "Gửi thử dữ liệu marketing mẫu",
      channel: "email",
      customer_types: ["vip", "loyal", "new"],
      subject: "Ưu đãi dùng thử NexCRM",
      content: "Xin chào {ten_khach_hang}, đây là chiến dịch email demo từ NexCRM.",
      recipient_count: 3,
      status: "sent",
      scheduled_at: null,
    });

    return 13;
  },
};
