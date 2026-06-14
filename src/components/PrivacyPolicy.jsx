export default function PrivacyPolicy({ onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.box} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>プライバシーポリシー</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <p style={styles.intro}>
            サロンつなぐ運営事務局（以下「当事務局」）は、本サービス「サロンつなぐ」（以下「本サービス」）における
            個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第1条　収集する個人情報</h3>
            <p style={styles.text}>当事務局は、本サービスの提供にあたり、以下の個人情報を収集することがあります。</p>
            <ul style={styles.list}>
              <li>メールアドレス（アカウント登録・認証のため）</li>
              <li>サロンに登録された顧客情報（氏名、電話番号、メールアドレス、来店履歴、備考等）</li>
              <li>予約・メニュー・スタッフに関する情報</li>
              <li>サービス利用ログ（アクセス日時、操作履歴等）</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第2条　個人情報の利用目的</h3>
            <p style={styles.text}>収集した個人情報は、以下の目的のために利用します。</p>
            <ul style={styles.list}>
              <li>本サービスのアカウント管理および認証</li>
              <li>予約・顧客・スタッフ・メニューの管理機能の提供</li>
              <li>サービスの保守・改善・障害対応</li>
              <li>重要なお知らせ・サポート対応のご連絡</li>
              <li>法令に基づく対応</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第3条　個人情報の第三者提供</h3>
            <p style={styles.text}>
              当事務局は、以下の場合を除き、収集した個人情報を第三者に提供しません。
            </p>
            <ul style={styles.list}>
              <li>ご本人の同意がある場合</li>
              <li>法令に基づき開示が必要な場合</li>
              <li>人の生命・身体・財産の保護のために必要な場合</li>
            </ul>
            <p style={styles.text}>
              なお、本サービスはデータベースとして Supabase（米国）を利用しており、
              データは同社のサーバーに保存されます。Supabase のプライバシーポリシーについては
              同社の公式サイトをご確認ください。
            </p>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第4条　個人情報の管理・安全対策</h3>
            <p style={styles.text}>
              当事務局は、個人情報への不正アクセス・漏えい・滅失・毀損を防止するため、
              適切なセキュリティ対策を講じます。収集した情報へのアクセスは
              本サービスの運営に必要な範囲に限定します。
            </p>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第5条　Cookie およびアクセス解析</h3>
            <p style={styles.text}>
              本サービスは、認証状態の維持等のために Cookie を利用することがあります。
              ブラウザの設定により Cookie を無効にすることができますが、
              その場合は一部機能が正常に動作しないことがあります。
            </p>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第6条　プライバシーポリシーの変更</h3>
            <p style={styles.text}>
              当事務局は、必要に応じて本ポリシーを変更することがあります。
              変更後のポリシーは本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>第7条　お問い合わせ</h3>
            <p style={styles.text}>
              個人情報の取り扱いに関するお問い合わせは、下記までご連絡ください。
            </p>
            <div style={styles.contactBox}>
              <p style={styles.contactItem}><strong>運営者</strong>：サロンつなぐ運営事務局</p>
              <p style={styles.contactItem}><strong>メール</strong>：準備中</p>
            </div>
          </section>

          <p style={styles.date}>制定日：2026年6月14日</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  box: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '640px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--gold)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  body: {
    overflowY: 'auto',
    padding: '20px 24px 24px',
  },
  intro: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '20px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '8px',
  },
  text: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '8px',
  },
  list: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.8,
    paddingLeft: '20px',
    marginBottom: '8px',
  },
  contactBox: {
    background: 'rgba(201,169,110,0.08)',
    border: '1px solid rgba(201,169,110,0.2)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '8px',
  },
  contactItem: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: '4px 0',
    lineHeight: 1.6,
  },
  date: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '24px',
    textAlign: 'right',
  },
}
