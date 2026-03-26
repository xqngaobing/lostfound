export default function GuidePage() {
  return (
    <div className="panel">
      <h2>使用说明</h2>
      <div className="form-grid">
        <div>
          <strong>发布者：</strong>发布前需先登录，联系方式来自注册手机号，仅用于认领沟通。
        </div>
        <div>
          <strong>失主认领：</strong>点击“这是我的东西”，填写验证信息，平台会把申请发送给发布者。
        </div>
        <div>
          <strong>物品编号：</strong>发布成功后会生成 5 位物品编号，用于查询和管理。
        </div>
        <div>
          <strong>举报：</strong>如发现不当内容，可在详情页提交举报。
        </div>
        <div>
          <strong>忘记密码：</strong>请联系开发人员 高彬 17346680278 进行修改。
        </div>
      </div>
    </div>
  );
}
